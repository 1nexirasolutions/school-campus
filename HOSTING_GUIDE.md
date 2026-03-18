# 🚀 School Campus - Hosting & Deployment Guide

## Architecture Overview

```
┌─────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Expo App   │────▶│  FastAPI Backend   │────▶│  MongoDB Atlas   │
│ (Android)   │     │  (Railway/Render)  │     │  (Free Cluster)  │
└─────────────┘     └───────────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Cloudflare  │
                    │     R2      │
                    │ (Files/CDN) │
                    └─────────────┘
```

---

## Part 1: MongoDB Atlas (Free Cloud Database)

### 1.1 Create Free Atlas Cluster

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up / Log in
3. Click **"Build a Database"**
4. Select **M0 FREE** tier
5. Choose cloud provider: **AWS** (closest region to India: **Mumbai ap-south-1**)
6. Cluster name: `school-campus`
7. Click **Create Cluster**

### 1.2 Configure Access

1. **Database Access** → Add Database User:
   - Username: `schooladmin`
   - Password: (generate a strong password, **save it!**)
   - Role: `Atlas admin`
   - Click **Add User**

2. **Network Access** → Add IP Address:
   - Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - This is needed because Railway/Render IPs are dynamic
   - Click **Confirm**

### 1.3 Get Connection String

1. Click **"Connect"** on your cluster
2. Choose **"Connect your application"**
3. Driver: **Python** / Version: **3.12 or later**
4. Copy the connection string. It looks like:
   ```
   mongodb+srv://schooladmin:<password>@school-campus.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password
6. Add the database name: change `/?retryWrites` to `/schoolerp?retryWrites`

Your final string:
```
mongodb+srv://schooladmin:YOUR_PASSWORD@school-campus.xxxxx.mongodb.net/schoolerp?retryWrites=true&w=majority
```

### 1.4 Migrate Local Data (Optional)

If you have data in your local MongoDB you want to keep:

```bash
# Export from local
mongodump --db schoolerp --out ./backup

# Import to Atlas
mongorestore --uri "mongodb+srv://schooladmin:PASSWORD@school-campus.xxxxx.mongodb.net" --db schoolerp ./backup/schoolerp
```

---

## Part 2: Deploy Backend on Railway

### 2.1 Setup Railway

1. Go to [https://railway.app](https://railway.app)
2. Sign up with **GitHub**
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Connect your GitHub account and select your repo
   - If your code isn't on GitHub yet, push it first:

```bash
cd /home/krishna/Videos/testing/finished
git init    # if not already
git add backend/
git commit -m "Backend for deployment"
git remote add origin https://github.com/YOUR_USERNAME/school-campus.git
git push -u origin main
```

### 2.2 Configure Railway

1. Once deployed, go to your service **Settings**:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

2. Go to **Variables** tab, add:
   ```
   MONGO_URL = mongodb+srv://schooladmin:PASSWORD@school-campus.xxxxx.mongodb.net/schoolerp?retryWrites=true&w=majority
   PORT = 8000
   ```

3. Railway will auto-deploy. Note your **public URL** like:
   ```
   https://school-campus-backend-production.up.railway.app
   ```

### Alternative: Deploy on Render (Free Tier)

1. Go to [https://render.com](https://render.com)
2. **New** → **Web Service** → Connect GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   - `MONGO_URL` = your Atlas connection string
5. Deploy!

> ⚠️ Render free tier sleeps after 15 min of inactivity (cold starts ~30s). Railway doesn't sleep but has usage-based billing after the free $5/month credit.

---

## Part 3: Build Android APK with EAS

### 3.1 Install EAS CLI

```bash
npm install -g eas-cli
```

### 3.2 Login to Expo

```bash
eas login
```
(Create an Expo account at [expo.dev](https://expo.dev) if you don't have one)

### 3.3 Set Backend URL

Create a `.env.production` file in your frontend:

```bash
# In /home/krishna/Videos/testing/finished/frontend/
echo "EXPO_PUBLIC_BACKEND_URL=https://YOUR-RAILWAY-URL.up.railway.app" > .env.production
```

### 3.4 Update app.json for Production

Make sure your `app.json` has the correct details:

```json
{
  "expo": {
    "name": "School Campus",
    "slug": "school-campus",
    "version": "1.0.0",
    "android": {
      "package": "com.schoolcampus.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#000"
      }
    }
  }
}
```

### 3.5 Build APK (for direct sharing)

```bash
cd /home/krishna/Videos/testing/finished/frontend
eas build --platform android --profile preview
```

This will:
- Upload your project to Expo's build servers
- Build a `.apk` file
- Give you a download link when done (~5-10 min)

### 3.6 Build AAB (for Play Store)

```bash
eas build --platform android --profile production
```

---

## Part 4: Cloudflare R2 (File Storage) — Future Use

### 4.1 Setup R2 Bucket

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name: `school-campus-files`
5. Location: **Asia Pacific**

### 4.2 Create API Token

1. Go to **R2** → **Manage R2 API Tokens**
2. Create token with **Object Read & Write** permissions
3. Save the **Access Key ID** and **Secret Access Key**

### 4.3 Add to Backend Env Variables

Add these to your Railway/Render environment:
```
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=school-campus-files
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

> R2 uses the S3-compatible API, so your existing `boto3` dependency works out of the box.

---

## Part 5: Quick Checklist

### Before Deployment:
- [ ] MongoDB Atlas cluster created and connection string obtained
- [ ] Railway/Render account created
- [ ] Expo account created (`eas login`)

### Deploy Backend:
- [ ] Push code to GitHub
- [ ] Create Railway/Render service from repo
- [ ] Set `MONGO_URL` environment variable
- [ ] Verify API is live: visit `https://YOUR-URL/api/classes`

### Deploy Frontend:
- [ ] Set `EXPO_PUBLIC_BACKEND_URL` in `.env.production`
- [ ] Update `app.json` slug and android package name
- [ ] Run `eas build --platform android --profile preview`
- [ ] Download APK and install on your phone

### Post-Deploy:
- [ ] Add initial Principal user via backend demo-login or MongoDB Atlas UI
- [ ] Test Google Sign-In flow
- [ ] Verify all API endpoints work

---

## Troubleshooting

### "Network request failed" on Android
Your `EXPO_PUBLIC_BACKEND_URL` is wrong or the backend is down. Check:
```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/api/classes
```

### "Access denied" on login
The user's email hasn't been added by the principal yet. Add a principal first via Atlas or demo-login.

### MongoDB connection fails
- Check your Atlas connection string is correct
- Make sure you added `0.0.0.0/0` to Network Access
- Check the password doesn't have special chars that need URL encoding

### EAS build fails
- Make sure `eas.json` exists in the frontend root
- Run `npx expo install --fix` to fix dependency issues
- Check `app.json` has valid `android.package` name
