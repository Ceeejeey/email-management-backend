# ---------- Base Image ----------
# Use lightweight Node 22 Alpine image
FROM node:22-alpine3.21

# ---------- Set Work Directory ----------
WORKDIR /app

# ---------- Install Dependencies ----------
# Copy package.json + package-lock.json only (for caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ---------- Copy Source Code ----------
COPY . .

# ---------- Expose Port ----------
# Cloud Run will route traffic to this port
EXPOSE 3000

# ---------- Start Command ----------
CMD ["node", "app.js"]
