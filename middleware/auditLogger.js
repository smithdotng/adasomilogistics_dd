// middleware/auditLogger.js
const AuditLog = require('../models/AuditLog');

module.exports = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (req.session.user && req.method !== 'GET') {
      const auditLog = new AuditLog({
        user: req.session.user.id,
        action: req.method,
        endpoint: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        statusCode: res.statusCode,
        metadata: {
          body: req.body,
          params: req.params,
          query: req.query
        }
      });
      
      auditLog.save().catch(console.error);
    }
    
    originalSend.apply(res, arguments);
  };
  
  next();
};