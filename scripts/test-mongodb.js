import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Replace the placeholder with your Atlas connection string from .env or fallback to local
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/consolezone';

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export async function runStableAPIConnect() {
  try {
    console.log(`⏳ Attempting to connect to MongoDB at: ${uri.replace(/:([^:@]+)@/, ':****@')}`);
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    // Send a ping to confirm a successful connection
    const result = await client.db('admin').command({ ping: 1 });
    console.log(
      '✅ Pinged your deployment. You successfully connected to MongoDB!'
    );
    return result;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

// Run the function if this script is executed directly
const isDirectRun = process.argv[1] && (
  __filename === path.resolve(process.argv[1]) || 
  __filename === path.resolve(process.cwd(), process.argv[1])
);

if (isDirectRun) {
  runStableAPIConnect().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
