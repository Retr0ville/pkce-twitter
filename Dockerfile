FROM node:18-alpine

WORKDIR /app

# Install dependencies first (leverages Docker cache)
COPY package*.json ./
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy application code
COPY . .

# Set environment variables (these can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
