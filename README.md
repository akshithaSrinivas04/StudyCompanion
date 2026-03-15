# AI Study Companion - Vercel Deployment Guide

This project is a React + Vite application powered by Firebase and Google Gemini AI.

## Deployment Steps

1. **Push to GitHub**: Push your code to a GitHub repository.
2. **Import to Vercel**: Go to [Vercel](https://vercel.com) and import your repository.
3. **Configure Environment Variables**: In the Vercel project settings, add the following environment variables:
   - `GEMINI_API_KEY`: Your Google AI SDK key.
   - `VITE_FIREBASE_API_KEY`: From your Firebase config.
   - `VITE_FIREBASE_AUTH_DOMAIN`: From your Firebase config.
   - `VITE_FIREBASE_PROJECT_ID`: From your Firebase config.
   - `VITE_FIREBASE_STORAGE_BUCKET`: From your Firebase config.
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`: From your Firebase config.
   - `VITE_FIREBASE_APP_ID`: From your Firebase config.
   - `VITE_FIREBASE_FIRESTORE_DATABASE_ID`: From your Firebase config.

4. **Deploy**: Click deploy. Vercel will automatically detect the Vite configuration and build the project.

## Note on Mobile Deployment
While Vercel hosts the web application, you can use this as a **Progressive Web App (PWA)** or wrap it in a **WebView** using tools like Capacitor or Cordova to create a native Android/iOS experience.
