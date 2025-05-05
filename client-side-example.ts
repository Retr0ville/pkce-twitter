// Example client-side code for interacting with the Twitter API backend
// This could be used in a React, Vue, or other frontend framework

// Types
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  twitterId?: string;
}

class TwitterApiClient {
  private baseUrl: string;
  private tokens: TokenData | null = null;

  constructor(baseUrl: string = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
    
    // Try to load tokens from local storage
    const storedTokens = localStorage.getItem('twitter_tokens');
    if (storedTokens) {
      this.tokens = JSON.parse(storedTokens);
    }
  }

  // Handle login by redirecting to Twitter auth
  public async login(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`);
      const data = await response.json();
      
      if (data.authUrl) {
        // Redirect to Twitter auth page
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Handle storing tokens after successful auth
  public setTokens(tokens: TokenData): void {
    this.tokens = tokens;
    localStorage.setItem('twitter_tokens', JSON.stringify(tokens));
  }

  // Clear tokens on logout
  public logout(): void {
    this.tokens = null;
    localStorage.removeItem('twitter_tokens');
  }

  // Make authenticated requests to the backend
  private async makeAuthenticatedRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    if (!this.tokens) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify({
          ...body,
          accessToken: this.tokens.accessToken,
          refreshToken: this.tokens.refreshToken,
          expiresAt: this.tokens.expiresAt,
          twitterId: this.tokens.twitterId
        }) : JSON.stringify({
          accessToken: this.tokens.accessToken,
          refreshToken: this.tokens.refreshToken,
          expiresAt: this.tokens.expiresAt,
          twitterId: this.tokens.twitterId
        }),
      });

      const data = await response.json();

      // Check if tokens were refreshed
      if (data.tokens) {
        this.setTokens(data.tokens);
      }

      return data;
    } catch (error) {
      console.error(`Error on ${endpoint}:`, error);
      throw error;
    }
  }

  // Verify user authentication
  public async verifyAuth(): Promise<any> {
    return this.makeAuthenticatedRequest('/auth/verify');
  }

  // Like a tweet
  public async likeTweet(tweetId: string): Promise<any> {
    return this.makeAuthenticatedRequest('/tweets/like', 'POST', { tweetId });
  }

  // Retweet a tweet
  public async retweet(tweetId: string): Promise<any> {
    return this.makeAuthenticatedRequest('/tweets/retweet', 'POST', { tweetId });
  }

  // Get user stats
  public async getUserStats(): Promise<any> {
    return this.makeAuthenticatedRequest('/user/stats');
  }

  // Revoke tokens
  public async revokeAuth(): Promise<any> {
    const result = await this.makeAuthenticatedRequest('/auth/revoke', 'POST');
    this.logout();
    return result;
  }
}

// Usage example:
/*
const twitterClient = new TwitterApiClient();

// Login button click handler
function handleLogin() {
  twitterClient.login().catch(console.error);
}

// After successful authentication and redirect back
function handleAuthSuccess() {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('accessToken');
  const refreshToken = urlParams.get('refreshToken');
  const expiresAt = urlParams.get('expiresAt');
  const twitterId = urlParams.get('twitterId');
  
  if (accessToken && refreshToken && expiresAt) {
    twitterClient.setTokens({
      accessToken,
      refreshToken,
      expiresAt: parseInt(expiresAt, 10),
      twitterId: twitterId || undefined
    });
    
    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Like tweet example
async function likeTweet(tweetId) {
  try {
    const response = await twitterClient.likeTweet(tweetId);
    console.log('Tweet liked:', response);
  } catch (error) {
    console.error('Failed to like tweet:', error);
  }
}

// Retweet example
async function retweet(tweetId) {
  try {
    const response = await twitterClient.retweet(tweetId);
    console.log('Tweet retweeted:', response);
  } catch (error) {
    console.error('Failed to retweet:', error);
  }
}

// Logout example
async function logout() {
  try {
    await twitterClient.revokeAuth();
    console.log('Logged out successfully');
  } catch (error) {
    console.error('Failed to logout:', error);
  }
}
*/
