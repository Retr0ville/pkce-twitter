// src/server.ts
import express, { Request, Response } from 'express';
import { Client, auth } from 'twitter-api-sdk';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import prisma from './prisma';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Constants
const STATE = 'twitter-auth-state';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/api/auth/callback';

// Types
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Interface for Twitter user data
interface TwitterUserData {
  id: string;
  username?: string;
  name?: string;
  profile_image_url?: string;
}

// Create auth client
const authClient = new auth.OAuth2User({
  client_id: process.env.TWITTER_CLIENT_ID as string,
  client_secret: process.env.TWITTER_CLIENT_SECRET as string,
  callback: CALLBACK_URL,
  scopes: ['tweet.read', 'users.read', 'tweet.write', 'like.write', 'offline.access'],
});

// Middleware to handle authentication
const withAuth = async (req: Request, res: Response, next: Function) => {
  try {
    const { accessToken, refreshToken, expiresAt, twitterId } = req.body;
    
    if (!accessToken || !refreshToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Set the tokens in the auth client
    authClient.token = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_at: expiresAt,
    };

    // Check if token is expired and needs refresh
    const now = Date.now();
    if (expiresAt && now >= expiresAt) {
      console.log('Token expired, refreshing...');
      const refreshedTokens = await authClient.refreshAccessToken();
      
      // Update token data to be returned to client
      res.locals.tokenData = {
        accessToken: refreshedTokens.token.access_token,
        refreshToken: refreshedTokens.token.refresh_token || refreshToken, // Fallback to old refresh token if not provided
        expiresAt: refreshedTokens.token.expires_at,
      };
      
      // Update the user record in the database if twitterId is provided
      if (twitterId) {
        await prisma.user.updateMany({
          where: { twitterId },
          data: {
            accessToken: refreshedTokens.token.access_token,
            refreshToken: refreshedTokens.token.refresh_token || refreshToken,
            tokenExpiresAt: BigInt(refreshedTokens.token.expires_at as number),
            updatedAt: new Date(),
          },
        });
      }
    }

    // Create Twitter client with the authenticated user
    res.locals.twitterClient = new Client(authClient);
    
    // Store the Twitter user ID for use in other middleware/routes
    if (twitterId) {
      res.locals.twitterId = twitterId;
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Routes
const router = express.Router();

// Auth routes
router.get('/auth/login', (req: Request, res: Response) => {
  try {
    const authUrl = authClient.generateAuthURL({
      state: STATE,
      code_challenge_method: 's256',
    });
    res.json({ authUrl });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (state !== STATE) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    const tokenResponse = await authClient.requestAccessToken(code as string);
    
    // Extract token data
    const tokenData: TokenData = {
      accessToken: tokenResponse.token.access_token as string,
      refreshToken: tokenResponse.token.refresh_token as string,
      expiresAt: tokenResponse.token.expires_at as number,
    };

    // Create a Twitter client to get user data
    const tempClient = new Client(new auth.OAuth2User({
      client_id: process.env.TWITTER_CLIENT_ID as string,
      client_secret: process.env.TWITTER_CLIENT_SECRET as string,
      callback: CALLBACK_URL,
      scopes: ['tweet.read', 'users.read', 'tweet.write', 'like.write', 'offline.access'],
      token: tokenResponse.token,
    }));

    // Get Twitter user data
    const twitterUser = await tempClient.users.findMyUser();
    
    if (twitterUser.data) {
      // Store or update user in database
      await prisma.user.upsert({
        where: { twitterId: twitterUser.data.id },
        update: {
          username: twitterUser.data.username,
          name: twitterUser.data.name,
          profileImgUrl: twitterUser.data.profile_image_url,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenExpiresAt: BigInt(tokenData.expiresAt),
          updatedAt: new Date(),
        },
        create: {
          twitterId: twitterUser.data.id,
          username: twitterUser.data.username,
          name: twitterUser.data.name,
          profileImgUrl: twitterUser.data.profile_image_url,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenExpiresAt: BigInt(tokenData.expiresAt),
        },
      });
    }

    // For this example, we'll redirect to the frontend with the token data as URL parameters
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth-success?${new URLSearchParams({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: tokenData.expiresAt.toString(),
      twitterId: twitterUser.data?.id || '',
    }).toString()}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/auth/revoke', withAuth, async (req: Request, res: Response) => {
  try {
    const response = await authClient.revokeAccessToken();
    res.json({ success: true, response });
  } catch (error) {
    console.error('Revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

router.get('/auth/verify', withAuth, async (req: Request, res: Response) => {
  try {
    const client = res.locals.twitterClient as Client;
    const userResponse = await client.users.findMyUser();
    
    // Return updated token data if tokens were refreshed
    const responseData = {
      user: userResponse.data,
      ...(res.locals.tokenData ? { tokens: res.locals.tokenData } : {})
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// Twitter API routes
router.post('/tweets/like', withAuth, async (req: Request, res: Response) => {
  try {
    const { tweetId } = req.body;
    
    if (!tweetId) {
      return res.status(400).json({ error: 'Tweet ID is required' });
    }
    
    const client = res.locals.twitterClient as Client;
    const userResponse = await client.users.findMyUser();
    const userId = userResponse.data.id;
    let success = false;
    let likeResponse;
    
    try {
      likeResponse = await client.tweets.usersIdLike(userId, {
        tweet_id: tweetId
      });
      success = true;
    } catch (likeError) {
      console.error('Error liking tweet:', likeError);
      success = false;
      likeResponse = likeError;
    }
    
    // Log the action in the database
    if (res.locals.twitterId) {
      const user = await prisma.user.findFirst({
        where: { twitterId: userId }
      });
      
      if (user) {
        await prisma.userAction.create({
          data: {
            userId: user.id,
            tweetId,
            action: 'like',
            success
          }
        });
      }
    }
    
    // Return response with updated tokens if refreshed
    const responseData = {
      success,
      data: likeResponse,
      ...(res.locals.tokenData ? { tokens: res.locals.tokenData } : {})
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Like tweet error:', error);
    res.status(500).json({ error: 'Failed to like tweet' });
  }
});

router.post('/tweets/retweet', withAuth, async (req: Request, res: Response) => {
  try {
    const { tweetId } = req.body;
    
    if (!tweetId) {
      return res.status(400).json({ error: 'Tweet ID is required' });
    }
    
    const client = res.locals.twitterClient as Client;
    const userResponse = await client.users.findMyUser();
    const userId = userResponse.data.id;
    let success = false;
    let retweetResponse;
    
    try {
      retweetResponse = await client.tweets.usersIdRetweets(userId, {
        tweet_id: tweetId
      });
      success = true;
    } catch (retweetError) {
      console.error('Error retweeting:', retweetError);
      success = false;
      retweetResponse = retweetError;
    }
    
    // Log the action in the database
    if (res.locals.twitterId) {
      const user = await prisma.user.findFirst({
        where: { twitterId: userId }
      });
      
      if (user) {
        await prisma.userAction.create({
          data: {
            userId: user.id,
            tweetId,
            action: 'retweet',
            success
          }
        });
      }
    }
    
    // Return response with updated tokens if refreshed
    const responseData = {
      success,
      data: retweetResponse,
      ...(res.locals.tokenData ? { tokens: res.locals.tokenData } : {})
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Retweet error:', error);
    res.status(500).json({ error: 'Failed to retweet' });
  }
});

// User stats endpoints
router.get('/user/stats', withAuth, async (req: Request, res: Response) => {
  try {
    const client = res.locals.twitterClient as Client;
    const userResponse = await client.users.findMyUser();
    const userId = userResponse.data.id;
    
    // Find user in database
    const user = await prisma.user.findFirst({
      where: { twitterId: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found in database' });
    }
    
    // Get action statistics
    const stats = await prisma.$transaction([
      prisma.userAction.count({
        where: { userId: user.id }
      }),
      prisma.userAction.count({
        where: { userId: user.id, action: 'like' }
      }),
      prisma.userAction.count({
        where: { userId: user.id, action: 'retweet' }
      }),
      prisma.userAction.count({
        where: { userId: user.id, success: true }
      }),
      prisma.userAction.count({
        where: { userId: user.id, success: false }
      }),
    ]);
    
    const responseData = {
      user: {
        id: user.twitterId,
        username: user.username,
        name: user.name,
        profileImgUrl: user.profileImgUrl,
      },
      stats: {
        totalActions: stats[0],
        likes: stats[1],
        retweets: stats[2],
        successful: stats[3],
        failed: stats[4],
      },
      ...(res.locals.tokenData ? { tokens: res.locals.tokenData } : {})
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

// Database health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Mount router
app.use('/api', router);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: Function) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Login endpoint: http://localhost:${PORT}/api/auth/login`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Server closed');
    process.exit(0);
  });
});
