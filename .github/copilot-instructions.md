# AI Copilot Instructions for Sign Language Translation App

## Project Overview

This is a **real-time sign language translation web application** built with Next.js 16, enabling Deaf/Hard of Hearing (DHH) and Hearing users to communicate through video calls with live gesture recognition and translation.

## Core Architecture

### ML & Detection Pipeline

- **Hand/Face/Pose Detection**: MediaPipe models (HandLandmarker, FaceLandmarker, PoseLandmarker) initialized from CDN
- **Sign Recognition**: ONNX Runtime with custom trained model (`/public/model/sign_model.onnx`)
- **Model Data**: Mean/std normalization files and label mappings loaded from `/public/model/`
- **Initialization**: Critical models initialized in `useEffect` in `translation/page.js` — async initialization with FilesetResolver

### Real-Time Communication

- **Video/Audio**: WebRTC (RTCPeerConnection) for peer-to-peer
- **Signaling & Messaging**: Socket.io to external backend (`https://backend-capstone-l19p.onrender.com`)
- **Detection Canvas**: Overlay canvas for visualization of detected landmarks
- **State Management**: ICE candidates queued and flushed after connection established

### Data & Authentication

- **Auth**: Firebase Auth with email/password, role-based via custom claims (`admin` claim)
- **Database**: Firestore for user data, translation history, feedback
- **Storage**: Firebase Storage for user uploads
- **API Routes**: Minimal — mostly delegated to Firebase and external Socket.io server

## Key Files & Patterns

### Critical Pages

| File                     | Purpose                                                 | Key Pattern                                                |
| ------------------------ | ------------------------------------------------------- | ---------------------------------------------------------- |
| `translation/page.js`    | **Main feature**: Video call + live gesture recognition | AI model initialization, WebRTC setup, real-time inference |
| `login/page.js`          | Auth + role routing                                     | Firebase custom claims, mounted state for hydration        |
| `userdashboard/page.js`  | User interface hub                                      | Dashboard composition from components                      |
| `admindashboard/page.js` | Admin analytics                                         | Role-based access via Firebase                             |

### Component Architecture

- **UI Components**: `components/dashboard/` (AnalyticsTab, FeedbackTab, OverviewTab, UserTab) — reusable dashboard sections
- **Config**: `utils/firebaseConfig.js` — Firebase initialization (auth, storage, db exports)
- **Styling**: Global Tailwind via `globals.css` with Geist font

## Developer Workflows

### Build & Development

```bash
npm run dev          # Dev server with Turbopack (port 3000)
npm run build        # Production build
npm start            # Start production server
```

### Key Environment Setup

1. **Firebase Project**: Credentials in `src/utils/firebaseConfig.js` (client-side)
2. **Custom Admin Script**: `scripts/createAdmin.js` — sets admin claim for users
3. **Socket.io Connection**: Hardcoded to `https://backend-capstone-l19p.onrender.com`

## Code Conventions & Patterns

### Client-Side Constraints

- **All pages use `"use client"`** — full client-side rendering for interactivity
- **Hydration Safety**: Wrap dynamic content in mounted checks (`const [mounted, setMounted] = useState(false)`)
- **No dynamic imports** — models loaded at component level via refs

### State Management

- **Refs for ML models**: `handRef`, `faceRef`, `poseRef`, `sessionRef` (ONNX) — persist across renders
- **React State**: UI-only (isMuted, cameraOn, callActive, translations array)
- **Socket.io Ref**: Single socket instance per page (`socket.current`)

### Firebase Patterns

- **Auth**: Use `getIdTokenResult(user)` to check custom claims → route based on role
- **Firestore**: Direct imports: `collection`, `addDoc`, `doc`, `getDoc`, `serverTimestamp`
- **Timestamps**: Always use `serverTimestamp()` for consistency

### UI & Notifications

- **Toast Notifications**: Built-in Toaster in layout.js with success (green #10B981) and error (red #EF4444) theming
- **Icons**: Use `react-icons` (FaPhone, FaMicrophone, FaVideo, etc.)
- **Charts**: `react-chartjs-2` + `recharts` for analytics

## Integration Points & External Dependencies

### External Services

- **Backend Server**: Socket.io at `https://backend-capstone-l19p.onrender.com` handles WebRTC signaling
- **CDN Resources**: MediaPipe models loaded from `storage.googleapis.com` and `cdn.jsdelivr.net`
- **ONNX Wasm**: Runtime files in `/public/ort/` (critical for inference)

### Dependency Notes

- **@mediapipe/tasks-vision**: 0.10.32 — requires specific WASM paths
- **onnxruntime-web**: 1.17.3 — WASM execution provider, thread configuration in translation/page.js
- **socket.io-client**: 4.8.1 — used for signaling, not WebRTC itself

## Common Tasks

### Add a New Page

1. Create folder in `src/app/newpage/`
2. Add `page.js` with `"use client"` at top
3. Import Firebase services from `@/utils/firebaseConfig`
4. Handle hydration if needed

### Debug AI Model Issues

- Verify model files in `/public/model/` exist (sign_model.onnx, mean.json, std.json, labels.json)
- Check ONNX Wasm paths: `ort.env.wasm.wasmPaths = "/ort/"`
- Model initialization in `translation/page.js` lines 70–95

### Add Firestore Data

- Import from `firebaseConfig`: `import { db } from "@/utils/firebaseConfig"`
- Use standard Firestore pattern: `addDoc(collection(db, "collectionName"), data)`
- Always include timestamps: `{ ...data, timestamp: serverTimestamp() }`
