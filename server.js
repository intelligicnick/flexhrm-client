// This file is the entry point for Hostinger Nodejs Hosting which looks for a root 'server.js'
process.env.NODE_ENV = 'production';

// Import the production-ready bundled server from the dist folder
import './dist/server.cjs';
