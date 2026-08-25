const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB...');
  const account = await mongoose.connection.collection('connectedaccounts').findOne({ email: 'thakoraryan94@gmail.com' });
  
  if (!account) {
    console.log('Guest account not found in MongoDB');
    process.exit(0);
  }
  
  console.log('--- Account details ---');
  console.log('  Email:', account.email);
  console.log('  tenantId:', account.tenantId);
  console.log('  tokenLength:', (account.microsoftAccessToken || '').length);

  if (account.microsoftAccessToken) {
    try {
      const decoded = jwt.decode(account.microsoftAccessToken);
      console.log('--- Token Payload ---');
      console.log('  tid (Tenant ID):', decoded.tid);
      console.log('  aud (Audience):', decoded.aud);
      console.log('  iss (Issuer):', decoded.iss);
      console.log('  scp (Scopes):', decoded.scp);
    } catch (e) {
      console.log('Could not decode token');
    }
  }
  
  process.exit(0);
}).catch(err => {
  console.error('DB Error:', err.message);
  process.exit(1);
});
