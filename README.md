# Reality Run

Scan your surroundings with the phone camera, then jump over toy versions of the things it found. One control: jump.

## Run it

```
npm install
npm run dev        # local development
npm test           # engine, model and vocabulary checks
npm run build      # production site in dist/
```

The camera needs HTTPS (or `localhost`). To try the dev server on a phone, run `npx localtunnel --port 5173` and open the https address it prints.

## Deploy

`dist/` is a ready-built static site. Upload it to any HTTPS host:

- Netlify: drag `dist/` onto app.netlify.com/drop
- Vercel: `npx vercel --prod` and set the output folder to `dist`
- Cloudflare Pages or GitHub Pages: publish `dist/` (paths are relative, so a sub-folder works)

Open the deployed address on a computer and the welcome screen shows a QR code for it.

## How it works

| Stage | What happens | Code |
| --- | --- | --- |
| Launch | Welcome screen, camera permission | `src/App.tsx`, `src/components/Welcome.tsx` |
| Scan | About 8 seconds of object detection on live camera frames, roughly nine frames a second | `src/components/Scan.tsx`, `src/vision/detector.ts` |
| Vocabulary | Detections are followed across frames, de-duplicated, measured and coloured | `src/vision/tracker.ts`, `src/vision/vocabulary.ts` |
| Obstacles | Each vocabulary object becomes a procedural toy model in its own colour | `src/render/models.ts`, `src/game/catalog.ts` |
| Play | Deterministic fixed-step engine, drawn over the camera feed | `src/game/engine.ts`, `src/render/scene.ts` |

Detection runs only during the scan and the detector is closed before play starts. The engine has no dependency on rendering or the camera.

### The vocabulary

Each object found is stored like this:

```json
{
  "id": "chair-1", "type": "chair", "label": "chair", "shape": "tall",
  "relative_size": "medium", "color": "brown", "color_hex": "#8a5a3c",
  "position": { "x": 0.41, "y": 0.62, "zone": "center" },
  "coverage": 0.11, "aspect": 0.78, "confidence": 0.83, "sightings": 27,
  "jumpable": true
}
```

- An object must be seen in at least three frames to count.
- The number kept per category never exceeds the most that were visible together in one frame, so an object that leaves the view and returns is not counted twice.
- People are discarded as soon as the detector reports them and are never stored.
- `environment` is a guess from the mix of objects.

### Fair play

Sizes are normalised so every obstacle can be cleared: a fridge becomes a toy fridge one unit tall. `npm test` checks that every category is jumpable at every size, that a well-timed bot survives four minutes on 48 different courses, that a jump 70 ms early or late still clears the tallest obstacles, and that 30, 60 and 144 fps give the same run.

## Limits to know about

- **The detector knows 80 everyday categories** (the COCO set), and 42 of them have toy models: chair, sofa, plant pot, bed, table, TV, laptop, books, clock, vase, bottle, cup, glass, bowl, bench, bicycle, motorbike, car, bus, truck, backpack, suitcase, bag, umbrella, ball, apple, orange, teddy bear, keyboard, phone, remote, mouse, fire hydrant, skateboard, microwave, oven, toaster, fridge, toilet, sink, stop sign, traffic light. It cannot recognise rocks, bushes, trees, lamps or cardboard boxes; those need a different or custom-trained model. Other detected categories (animals, food, cutlery and so on) are stored in the vocabulary with `jumpable: false` and are not used.
- **No surface or depth estimation.** Position is where the object sat in the camera view, and size is how much of the view it filled.
- **The lane is fixed to the screen**, not anchored to the floor. The phone is meant to stay still during play.
- **Colour is the dominant colour in the middle of the detection box**, softened to a pastel. Background showing through an object can skew it.
- **Not yet run on a phone.** The engine, models and vocabulary logic are tested; the camera, detector and on-screen rendering have not been run on a device.
- **Demo mode** uses four preset objects and is labelled "Demo world, not your scan". It is offered only when the camera or the detector is unavailable, or a scan finds nothing usable.

## Network dependencies

The detector's runtime and model are fetched at scan time from jsDelivr and Google's MediaPipe model storage; fonts come from Google Fonts. To self-host the detector, copy `node_modules/@mediapipe/tasks-vision/wasm` and the `.tflite` file into `public/` and change the two URLs at the top of `src/vision/detector.ts`.

## Third-party pieces

MediaPipe Tasks Vision and EfficientDet-Lite0 (Apache 2.0), Three.js (MIT), React (MIT), qrcode-generator (MIT), Bagel Fat One and Nunito typefaces (OFL).
