# Twitter API Backend

A TypeScript Node.js application that handles Twitter API interactions with user authentication, PostgreSQL integration, and token management.

## Features

- **Twitter OAuth 2.0 Authentication with PKCE**
- **Persistent User Data with PostgreSQL & Prisma ORM**
- **Automatic Token Refresh**
- **Twitter Actions**:
  - Like tweets
  - Retweet tweets
- **User Activity Tracking**
- **Client-Side Integration Example**

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL
- Twitter API Credentials (from Twitter Developer Portal)

### Installation

1. Clone the repository:
   ```bash
   git clone https://your-repo-url.git
   cd twitter-api-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your configuration:
   ```
   # Twitter API Credentials
   TWITTER_CLIENT_ID=your_twitter_client_id
   TWITTER_CLIENT_SECRET=your_twitter_client_secret

   # Server Configuration
   PORT=3000
   CALLBACK_URL=http://localhost:3000/api/auth/callback
   FRONTEND_URL=http://localhost:3001

   # Database Configuration
   DATABASE_URL="postgresql://username:password@localhost:5432/twitter_api_db?schema=public"
   ```

### Database Setup

1. Set up the database schema:
   ```bash
   npx prisma migrate dev --name init
   ```

2. (Optional) Seed the database:
   ```bash
   npx prisma db seed
   ```

3. (Optional) Explore your database with Prisma Studio:
   ```bash
   npx prisma studio
   ```

### Running the Application

Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Authentication

- `GET /api/auth/login` - Initiates the OAuth 2.0 flow
- `GET /api/auth/callback` - OAuth callback route
- `POST /api/auth/revoke` - Revokes the current access token
- `GET /api/auth/verify` - Verifies authentication status

### Twitter Actions

- `POST /api/tweets/like` - Likes a tweet
  - Requires: `tweetId` in request body
- `POST /api/tweets/retweet` - Retweets a tweet
  - Requires: `tweetId` in request body

### User Data

- `GET /api/user/stats` - Gets user statistics

### System

- `GET /api/health` - Database health check

## Database Schema

### User

Stores Twitter user information and authentication tokens.

### UserAction

Records user actions such as likes and retweets, along with success status.

## Using TypeScript in Production

This project uses `ts-node` to run TypeScript directly in production without compiling to JavaScript. The advantages include:

1. Streamlined development workflow
2. No build step required
3. Consistent environments between development and production
4. Better error reporting with source maps

## Client Integration

See the `client-side-example.ts` file for an example of how to integrate this backend with a frontend application.

## License

[MIT](LICENSE)
