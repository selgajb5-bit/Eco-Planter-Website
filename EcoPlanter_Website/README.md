# EcoPlanter Smart Agriculture Website

A responsive website for the EcoPlanter robotics project. It includes Home, Dashboard, Robot Controls, Planting Records, Settings, and About pages.

## Launch

Open `index.html` in a modern desktop or mobile browser. The interface runs **offline in Demo Mode**. If your browser restricts local files, run a local server in the extracted directory:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Demo Mode

The starting moisture, battery, count, activity, and camera image are **simulated**. The automatic planting button runs a visual software demonstration, not physical hardware. The seed counter tracks requested releases, not sensor-verified passage. The camera image is a **static concept illustration**, not live footage. Settings and records are stored in your browser's `localStorage`.

### Features to try

1. Dashboard > Start automatic cycle: simulate alignment, sensing, seeding, watering (only if soil is below the threshold), and recording.
2. Settings > Demo environment: choose dry, optimal, or wet soil to test conditional watering.
3. Robot Controls > Manual: control movement and arm actions in demo mode.
4. Records > Export CSV: download demo records.
5. Settings: set soil moisture threshold, watering duration, planting spacing and seeds per spot.
6. Click the moon icon to switch themes.
7. Emergency Stop locks **demo** controls until Settings > Reset demo data.

## Connecting an actual ESP32

The browser supports an optional WebSocket connection, but **you must develop compatible firmware**. Nothing on the website alone can operate an ESP32 without that firmware, network connectivity, motor drivers, adequate power, and safety controls.

1. Program your ESP32 with a WebSocket server on your network.
2. Implement the message contract below, servo/pump/motor hardware drivers, and independent watchdog/failsafe logic.
3. In Settings, enter a valid `ws://<device-ip>:<port>` endpoint and click Connect. On an HTTPS-hosted website, use `wss://` (typically via a reverse proxy with TLS) to avoid mixed-content blocking.
4. The website switches to Hardware Connected only after the WebSocket connection actually opens. If disconnected, it falls back to clearly labeled Demo Mode.

### Commands from website to ESP32

Example JSON payloads:

```json
{"type":"command","command":"start_auto"}
{"type":"command","command":"stop"}
{"type":"command","command":"emergency_stop"}
{"type":"command","command":"set_mode","mode":"manual"}
{"type":"command","command":"move","direction":"forward"}
{"type":"command","command":"stop_motion"}
{"type":"command","command":"seed_position"}
{"type":"command","command":"seed_drop"}
{"type":"command","command":"water_position"}
{"type":"command","command":"water_now"}
{"type":"command","command":"probe_raise"}
{"type":"command","command":"probe_check"}
```

`direction` values are `forward`, `backward`, `left`, `right`, `pivot_left`, `pivot_right`.

### Telemetry expected by the website

Firmware should periodically broadcast something like:

```json
{"type":"telemetry","moisture":34,"battery_pct":82,"seeds_dispensed":24,"pump_on":false,"running":false,"step":0,"status":"Idle","estop":false}
```

Optional keys are allowed. The UI updates only recognized keys. Hardware telemetry must come from actual sensors; the website does not invent live measurements while connected. This does not implement a live ESP32-CAM video stream: the camera tile remains an illustrative placeholder until you add a browser-compatible stream URL and a proper camera UI.

### Essential physical safety requirements

- A **physical emergency-stop switch**, motor power cutoff, and independent hardware watchdog are essential; browser stop buttons may fail if Wi-Fi fails.
- Stop drive motors if the Wi-Fi heartbeat/commands stop, and do not keep moving indefinitely after a lost connection.
- Use a dedicated servo power supply with adequate current, protection and shared signal ground. Never power high-torque servos from an ESP32 GPIO pin.
- Keep power electronics splash-protected, use suitable protected batteries/charging circuits, and prevent water leaks.
- Keep access to physical controls restricted; do not expose an unauthenticated robot-control WebSocket directly to the public internet.
- Calibrate sensor thresholds, servo positions and arm clearance using real hardware before enabling autonomous motion.

## Tech stack

HTML5, CSS3, and vanilla JavaScript. No npm packages, build process, internet connection or third-party CDNs required. Robot visuals come from the EcoPlanter concept illustrations created earlier.

## Folder layout

```
EcoPlanter_Website/
  index.html
  styles.css
  app.js
  README.md
  assets/
    favicon.svg
    ecoplanter-hero.webp
    seed-drop.webp
    watering.webp
    soil-probe.webp
```

**Note:** This is a frontend prototype, not finished robot firmware or a deployed public website.
