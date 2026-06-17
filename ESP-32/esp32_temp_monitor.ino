#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <NimBLEDevice.h>

#define DHT_PIN        18
#define DHT_TYPE       DHT22
#define LED1_PIN       2
#define LED2_PIN       15
#define LED_R_PIN      17
#define LED_G_PIN      16
#define LED_B_PIN      4

#define BTN_SCREEN_PIN 26
#define BTN_RESET_PIN  27
#define SW_BLOCK_PIN   34
#define SW_LED1_PIN    32
#define SW_LED2_PIN    35
#define SW_UNIT_PIN    33

#define RGB_COMMON_ANODE   false

const uint32_t DHT_READ_MS      = 2000;
const uint32_t LCD_AUTO_MS      = 3000;
const uint32_t NOTIFY_MS        = 1000;
const uint32_t DEBOUNCE_MS      = 40;
const uint8_t  HISTORY_SIZE     = 60;
const uint32_t HISTORY_SLOT_MS  = 60000;

#define SVC_ENV_UUID        "181A"
#define CH_CURRENT_UUID     "2A6E"
#define CH_HISTORY_UUID     "7b2f0101-9b8a-4a2c-91f4-8f6b4f1a0001"

#define SVC_ACT_UUID        "7b2f0001-9b8a-4a2c-91f4-8f6b4f1a0001"
#define CH_LEDS_UUID        "7b2f0002-9b8a-4a2c-91f4-8f6b4f1a0001"
#define CH_RGB_UUID         "7b2f0003-9b8a-4a2c-91f4-8f6b4f1a0001"

#define SVC_CONN_UUID       "7b2f1001-9b8a-4a2c-91f4-8f6b4f1a0001"
#define CH_RSSI_UUID        "7b2f1002-9b8a-4a2c-91f4-8f6b4f1a0001"
#define CH_NOTIFCNT_UUID    "7b2f1003-9b8a-4a2c-91f4-8f6b4f1a0001"

#define SVC_SYS_UUID        "7b2f2000-9b8a-4a2c-91f4-8f6b4f1a0001"
#define CH_SYSSTATE_UUID    "7b2f2001-9b8a-4a2c-91f4-8f6b4f1a0001"
#define CH_SYSCMD_UUID      "7b2f2002-9b8a-4a2c-91f4-8f6b4f1a0001"

#define DEVICE_NAME         "ESP32_TEMP_MONITOR"
#define BLE_PASSKEY         696969

#define CLEAR_BONDS_ON_BOOT  true

struct Button {
  uint8_t pin;
  bool stable;
  bool lastRaw;
  uint32_t tMs;
};

DHT dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);

float curTempC = NAN, curTempF = NAN, curHum = NAN;
float minTempC = NAN, maxTempC = NAN, minHum = NAN, maxHum = NAN;

float histTemp[HISTORY_SIZE];
float histHum[HISTORY_SIZE];
uint8_t histCount = 0;

double accTemp = 0, accHum = 0;
uint32_t accN = 0;
uint32_t lastHistMs = 0;

bool led1On = false, led2On = false;

bool swBlock = false;
bool swLed1  = false;
bool swLed2  = false;
bool swUnit  = false;
bool lastSwLed1 = false, lastSwLed2 = false;

bool remoteLocked() { return swBlock; }

uint8_t lcdScreen = 0;
uint8_t lastRenderedScreen = 255;
const uint8_t LCD_SCREENS = 5;
uint32_t lastLcdMs = 0;

volatile bool deviceConnected = false;
uint16_t connHandle = BLE_HS_CONN_HANDLE_NONE;
int8_t curRssi = 0;

uint16_t notifCount = 0;
uint16_t notifCountWindow = 0;
uint32_t lastNotifWindowMs = 0;

uint32_t lastDhtMs = 0;
uint32_t lastNotifyMs = 0;

NimBLECharacteristic *chCurrent, *chHistory, *chLeds, *chRgb,
                     *chRssi, *chNotifCnt, *chSysState, *chSysCmd;

Button btnScreen{BTN_SCREEN_PIN,false,false,0};
Button btnReset {BTN_RESET_PIN ,false,false,0};

int8_t getServerPeerRssi(uint16_t handle) {
  if (handle == BLE_HS_CONN_HANDLE_NONE) return 0;
  int8_t rssi = 0;
  if (ble_gap_conn_rssi(handle, &rssi) != 0) return 0;
  return rssi;
}

void applyLed1() { digitalWrite(LED1_PIN, led1On ? HIGH : LOW); }
void applyLed2() { digitalWrite(LED2_PIN, led2On ? HIGH : LOW); }
void setLed1(bool s) { led1On = s; applyLed1(); }
void setLed2(bool s) { led2On = s; applyLed2(); }

void setRgb(uint8_t r, uint8_t g, uint8_t b) {
#if RGB_COMMON_ANODE
  uint8_t pr = 255 - r, pg = 255 - g, pb = 255 - b;
#else
  uint8_t pr = r, pg = g, pb = b;
#endif
  ledcWrite(LED_R_PIN, pr);
  ledcWrite(LED_G_PIN, pg);
  ledcWrite(LED_B_PIN, pb);
  Serial.printf("[RGB] ledcWrite -> R(pin%d)=%u G(pin%d)=%u B(pin%d)=%u\n",
                LED_R_PIN, pr, LED_G_PIN, pg, LED_B_PIN, pb);
}

void updateCurrentChar(bool notify) {
  uint8_t buf[12];
  float t = isnan(curTempC) ? 0 : curTempC;
  float f = isnan(curTempF) ? 0 : curTempF;
  float h = isnan(curHum)   ? 0 : curHum;
  memcpy(buf + 0, &t, 4);
  memcpy(buf + 4, &f, 4);
  memcpy(buf + 8, &h, 4);
  chCurrent->setValue(buf, sizeof(buf));
  if (notify && deviceConnected) {
    chCurrent->notify();
    notifCount++;
    notifCountWindow++;
  }
}

void updateLedsChar() {
  uint8_t b = (led1On ? 0x01 : 0) | (led2On ? 0x02 : 0);
  chLeds->setValue(&b, 1);
}

void updateRssiChar(bool notify) {
  int8_t v = curRssi;
  chRssi->setValue((uint8_t*)&v, 1);
  if (notify && deviceConnected) chRssi->notify();
}

void updateNotifCntChar() {
  uint16_t v = notifCountWindow;
  chNotifCnt->setValue((uint8_t*)&v, 2);
}

void updateSysStateChar(bool notify) {
  uint8_t buf[3];
  buf[0] = (swBlock?0x01:0) | (swLed1?0x02:0) | (swLed2?0x04:0) | (swUnit?0x08:0);
  buf[1] = (remoteLocked()?0x01:0) | (swUnit?0x02:0) | (deviceConnected?0x04:0);
  buf[2] = lcdScreen;
  chSysState->setValue(buf, sizeof(buf));
  if (notify && deviceConnected) chSysState->notify();
}

void updateHistoryChar() {
  static uint8_t buf[HISTORY_SIZE * 4 + 1];
  buf[0] = histCount;
  uint16_t idx = 1;
  for (uint8_t i = 0; i < HISTORY_SIZE; i++) {
    int16_t v = (i < histCount && !isnan(histTemp[i])) ? (int16_t)(histTemp[i]*100) : 0;
    buf[idx++] = v & 0xFF; buf[idx++] = (v >> 8) & 0xFF;
  }
  for (uint8_t i = 0; i < HISTORY_SIZE; i++) {
    int16_t v = (i < histCount && !isnan(histHum[i])) ? (int16_t)(histHum[i]*100) : 0;
    buf[idx++] = v & 0xFF; buf[idx++] = (v >> 8) & 0xFF;
  }
  chHistory->setValue(buf, idx);
}

void resetMinMax() {
  minTempC = maxTempC = curTempC;
  minHum   = maxHum   = curHum;
}

void pushHistorySlot(float t, float h) {
  if (histCount < HISTORY_SIZE) {
    histTemp[histCount] = t; histHum[histCount] = h; histCount++;
  } else {
    for (uint8_t i = 1; i < HISTORY_SIZE; i++) {
      histTemp[i-1] = histTemp[i]; histHum[i-1] = histHum[i];
    }
    histTemp[HISTORY_SIZE-1] = t; histHum[HISTORY_SIZE-1] = h;
  }
  updateHistoryChar();
}

void readSensor() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("[DHT] Falha de leitura");
    return;
  }
  curTempC = t;
  curTempF = t * 9.0 / 5.0 + 32.0;
  curHum   = h;

  if (isnan(minTempC)) resetMinMax();
  if (t < minTempC) minTempC = t;
  if (t > maxTempC) maxTempC = t;
  if (h < minHum)   minHum   = h;
  if (h > maxHum)   maxHum   = h;

  accTemp += t; accHum += h; accN++;

  updateCurrentChar(false);
}

const char* bleStateStr() { return deviceConnected ? "Conectado" : "Anunciando"; }

void lcdLine(uint8_t row, const String& s) {
  String t = s;
  while (t.length() < 16) t += ' ';
  if (t.length() > 16) t = t.substring(0, 16);
  lcd.setCursor(0, row);
  lcd.print(t);
}

void renderLcd() {
  char l0[24], l1[24];
  switch (lcdScreen) {
    case 0:
      snprintf(l0, sizeof(l0), "Temp: %.1f%cC", isnan(curTempC)?0:curTempC, (char)223);
      snprintf(l1, sizeof(l1), "Umid: %.1f%%",  isnan(curHum)?0:curHum);
      break;
    case 1:
      snprintf(l0, sizeof(l0), "Temp: %.1f%cF", isnan(curTempF)?0:curTempF, (char)223);
      snprintf(l1, sizeof(l1), "Umid: %.1f%%",  isnan(curHum)?0:curHum);
      break;
    case 2:
      snprintf(l0, sizeof(l0), "Tmin:%.1f%cC", isnan(minTempC)?0:minTempC, (char)223);
      snprintf(l1, sizeof(l1), "Tmax:%.1f%cC", isnan(maxTempC)?0:maxTempC, (char)223);
      break;
    case 3:
      snprintf(l0, sizeof(l0), "Hmin:%.1f%%", isnan(minHum)?0:minHum);
      snprintf(l1, sizeof(l1), "Hmax:%.1f%%", isnan(maxHum)?0:maxHum);
      break;
    case 4:
      snprintf(l0, sizeof(l0), "BLE: %s", bleStateStr());
      if (deviceConnected) snprintf(l1, sizeof(l1), "RSSI: %ddBm", curRssi);
      else                 snprintf(l1, sizeof(l1), "Aguardando...");
      break;
    default:
      l0[0] = l1[0] = '\0';
      break;
  }
  lcdLine(0, l0);
  lcdLine(1, l1);
  lastRenderedScreen = lcdScreen;
}

void goToScreen(uint8_t s) {
  lcdScreen = s % LCD_SCREENS;
  lastLcdMs = millis();
  renderLcd();
  updateSysStateChar(true);
}

void nextScreen() {
  goToScreen(lcdScreen + 1);
}

bool pressedEdge(Button &b) {
  bool pressedRaw = (digitalRead(b.pin) == HIGH);
  uint32_t now = millis();
  if (pressedRaw != b.lastRaw) { b.lastRaw = pressedRaw; b.tMs = now; }
  if ((now - b.tMs) > DEBOUNCE_MS && pressedRaw != b.stable) {
    b.stable = pressedRaw;
    if (b.stable) return true;
  }
  return false;
}

void readSwitches() {
  bool nBlock = (digitalRead(SW_BLOCK_PIN) == HIGH);
  bool nLed1  = (digitalRead(SW_LED1_PIN)  == HIGH);
  bool nLed2  = (digitalRead(SW_LED2_PIN)  == HIGH);
  bool nUnit  = (digitalRead(SW_UNIT_PIN)  == HIGH);

  bool changed = (nBlock!=swBlock)||(nLed1!=swLed1)||(nLed2!=swLed2)||(nUnit!=swUnit);
  swBlock=nBlock; swLed1=nLed1; swLed2=nLed2; swUnit=nUnit;

  if (swLed1 != lastSwLed1) { lastSwLed1 = swLed1; setLed1(swLed1); updateLedsChar(); }
  if (swLed2 != lastSwLed2) { lastSwLed2 = swLed2; setLed2(swLed2); updateLedsChar(); }

  if (changed) updateSysStateChar(true);
}

class ServerCB : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* s, NimBLEConnInfo& info) override {
    deviceConnected = true;
    connHandle = info.getConnHandle();
    s->updateConnParams(connHandle, 40, 80, 0, 200);
    Serial.println("[BLE] Conectado");
    updateSysStateChar(false);
  }
  void onDisconnect(NimBLEServer* s, NimBLEConnInfo& info, int reason) override {
    deviceConnected = false;
    connHandle = BLE_HS_CONN_HANDLE_NONE;
    Serial.printf("[BLE] Desconectado (reason=%d). Re-anunciando...\n", reason);
    NimBLEDevice::startAdvertising();
  }

  uint32_t onPassKeyDisplay() override {
    Serial.printf("[BLE] Passkey a digitar no celular: %u\n", BLE_PASSKEY);
    return BLE_PASSKEY;
  }

  void onConfirmPassKey(NimBLEConnInfo& info, uint32_t pin) override {
    Serial.printf("[BLE] Confirmar passkey: %u\n", pin);
    NimBLEDevice::injectConfirmPasskey(info, pin == BLE_PASSKEY);
  }

  void onAuthenticationComplete(NimBLEConnInfo& info) override {
    Serial.printf("[BLE] AuthComplete enc=%d auth=%d bond=%d keysize=%d\n",
                  info.isEncrypted(), info.isAuthenticated(),
                  info.isBonded(), info.getSecKeySize());
    if (!info.isEncrypted()) {
      Serial.println("[BLE] Falha de autenticacao - desconectando");
      NimBLEDevice::getServer()->disconnect(info.getConnHandle());
    } else {
      Serial.printf("[BLE] Pareamento OK (criptografado) com %s\n",
                    info.getAddress().toString().c_str());
    }
  }
};

void dumpWrite(const char* tag, NimBLECharacteristic* c, const std::string& v) {
  Serial.printf("[BLE][%s] write len=%u bytes:", tag, (unsigned)v.size());
  for (size_t i = 0; i < v.size(); i++) Serial.printf(" %02X", (uint8_t)v[i]);
  Serial.print("  uuid="); Serial.println(c->getUUID().toString().c_str());
}

class LedsCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo& info) override {
    std::string v = c->getValue();
    dumpWrite("LEDS", c, v);
    if (remoteLocked()) {
      Serial.println("[BLE] Escrita LEDs IGNORADA (Switch 1 bloqueia remoto)");
      updateLedsChar();
      return;
    }
    if (v.size() < 1) { Serial.println("[BLE][LEDS] payload vazio, ignorado"); return; }
    uint8_t b = (uint8_t)v[0];
    setLed1(b & 0x01);
    setLed2(b & 0x02);
    Serial.printf("[BLE][LEDS] LED1=%d LED2=%d\n", led1On, led2On);
    updateLedsChar();
  }
};

class RgbCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo& info) override {
    std::string v = c->getValue();
    dumpWrite("RGB", c, v);
    if (v.size() < 3) {
      Serial.printf("[BLE][RGB] payload com %u bytes (<3) -> IGNORADO. "
                    "Envie exatamente 3 bytes R,G,B.\n", (unsigned)v.size());
      return;
    }
    uint8_t r = (uint8_t)v[0], g = (uint8_t)v[1], b = (uint8_t)v[2];
    Serial.printf("[BLE][RGB] aplicando R=%u G=%u B=%u (anodo_comum=%d)\n",
                  r, g, b, RGB_COMMON_ANODE);
    setRgb(r, g, b);
  }
};

class SysCmdCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo& info) override {
    std::string v = c->getValue();
    dumpWrite("SYSCMD", c, v);
    if (v.size() < 1) return;
    switch ((uint8_t)v[0]) {
      case 0x01: resetMinMax(); renderLcd();
                 Serial.println("[CMD] Reset min/max"); break;
      case 0x02: nextScreen();
                 Serial.println("[CMD] Proxima tela LCD"); break;
      case 0x03: updateSysStateChar(true); updateHistoryChar();
                 Serial.println("[CMD] Refresh estado"); break;
    }
  }
};

void setupBle() {
  NimBLEDevice::init(DEVICE_NAME);
  NimBLEDevice::setPower(9);

#if CLEAR_BONDS_ON_BOOT
  NimBLEDevice::deleteAllBonds();
  Serial.println("[BLE] Bonds antigos apagados");
#endif

  NimBLEDevice::setSecurityAuth(
      BLE_SM_PAIR_AUTHREQ_BOND | BLE_SM_PAIR_AUTHREQ_MITM | BLE_SM_PAIR_AUTHREQ_SC);
  NimBLEDevice::setSecurityIOCap(BLE_HS_IO_DISPLAY_ONLY);
  NimBLEDevice::setSecurityPasskey(BLE_PASSKEY);

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCB());

  NimBLEService* sEnv = server->createService(SVC_ENV_UUID);
  chCurrent = sEnv->createCharacteristic(CH_CURRENT_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ_ENC);
  chHistory = sEnv->createCharacteristic(CH_HISTORY_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::READ_ENC);
  sEnv->start();

  NimBLEService* sAct = server->createService(SVC_ACT_UUID);
  chLeds = sAct->createCharacteristic(CH_LEDS_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE |
      NIMBLE_PROPERTY::READ_ENC | NIMBLE_PROPERTY::WRITE_ENC);
  chLeds->setCallbacks(new LedsCB());
  chRgb = sAct->createCharacteristic(CH_RGB_UUID,
      NIMBLE_PROPERTY::WRITE_NR | NIMBLE_PROPERTY::WRITE_ENC);
  chRgb->setCallbacks(new RgbCB());
  sAct->start();

  NimBLEService* sConn = server->createService(SVC_CONN_UUID);
  chRssi = sConn->createCharacteristic(CH_RSSI_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ_ENC);
  chNotifCnt = sConn->createCharacteristic(CH_NOTIFCNT_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::READ_ENC);
  sConn->start();

  NimBLEService* sSys = server->createService(SVC_SYS_UUID);
  chSysState = sSys->createCharacteristic(CH_SYSSTATE_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ_ENC);
  chSysCmd = sSys->createCharacteristic(CH_SYSCMD_UUID,
      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_ENC);
  chSysCmd->setCallbacks(new SysCmdCB());
  sSys->start();

  updateCurrentChar(false);
  updateLedsChar();
  updateRssiChar(false);
  updateNotifCntChar();
  updateSysStateChar(false);
  updateHistoryChar();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SVC_ENV_UUID);
  adv->setName(DEVICE_NAME);
  adv->setMinInterval(640);
  adv->setMaxInterval(640);
  NimBLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising iniciado");
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== ESP32 TEMP MONITOR ===");

  pinMode(LED1_PIN, OUTPUT); pinMode(LED2_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW); digitalWrite(LED2_PIN, LOW);

  bool okR = ledcAttach(LED_R_PIN, 5000, 8);
  bool okG = ledcAttach(LED_G_PIN, 5000, 8);
  bool okB = ledcAttach(LED_B_PIN, 5000, 8);
  Serial.printf("[RGB] ledcAttach R=%d G=%d B=%d (1=ok)\n", okR, okG, okB);
  setRgb(0,0,0);

  pinMode(BTN_SCREEN_PIN, INPUT);
  pinMode(BTN_RESET_PIN,  INPUT);
  pinMode(SW_LED1_PIN,    INPUT);
  pinMode(SW_UNIT_PIN,    INPUT);
  pinMode(SW_BLOCK_PIN,   INPUT);
  pinMode(SW_LED2_PIN,    INPUT);

  Wire.begin();
  Wire.setClock(100000);
  lcd.init(); lcd.backlight();
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("ESP32 TEMP");
  lcd.setCursor(0,1); lcd.print("Iniciando...");

  dht.begin();
  setupBle();

  delay(1500);
  readSensor();
  resetMinMax();

  swLed1 = lastSwLed1 = (digitalRead(SW_LED1_PIN) == HIGH);
  swLed2 = lastSwLed2 = (digitalRead(SW_LED2_PIN) == HIGH);
  setLed1(swLed1); setLed2(swLed2); updateLedsChar();
  swBlock = (digitalRead(SW_BLOCK_PIN) == HIGH);
  swUnit  = (digitalRead(SW_UNIT_PIN)  == HIGH);
  updateSysStateChar(false);

  lcd.clear();
  goToScreen(0);

  uint32_t now = millis();
  lastDhtMs = lastNotifyMs = lastLcdMs = lastHistMs = lastNotifWindowMs = now;
}

void loop() {
  uint32_t now = millis();

  if (pressedEdge(btnScreen)) nextScreen();
  if (pressedEdge(btnReset)) { resetMinMax(); renderLcd();
                               Serial.println("[PB2] reset min/max"); }

  readSwitches();

  if (now - lastDhtMs >= DHT_READ_MS) {
    lastDhtMs = now;
    readSensor();
    if (lcdScreen <= 3) renderLcd();
  }

  if (now - lastHistMs >= HISTORY_SLOT_MS) {
    lastHistMs = now;
    if (accN > 0) { pushHistorySlot(accTemp/accN, accHum/accN); accTemp=accHum=0; accN=0; }
  }

  if (now - lastLcdMs >= LCD_AUTO_MS) {
    nextScreen();
  }

  if (now - lastNotifyMs >= NOTIFY_MS) {
    lastNotifyMs = now;
    updateCurrentChar(true);
    if (deviceConnected) {
      curRssi = getServerPeerRssi(connHandle);
      updateRssiChar(true);
      if (lcdScreen == 4) renderLcd();
    }
  }

  if (now - lastNotifWindowMs >= 60000) {
    lastNotifWindowMs = now;
    updateNotifCntChar();
    notifCountWindow = 0;
  }
}
