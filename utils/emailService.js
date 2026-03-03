const nodemailer = require('nodemailer');

// Create transporter with better configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Only for development
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000, // 10 seconds
    socketTimeout: 15000 // 15 seconds
});

// Verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.log('Email server connection error:', error);
        console.log('Email functionality will be disabled. Check your .env configuration.');
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Send welcome email to new operator
exports.sendOperatorCredentials = async (email, tempPassword, data) => {
    // Skip email sending if in development mode without proper config
    if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
        console.log('DEVELOPMENT MODE: Email sending skipped');
        console.log('Credentials for', email, ':', tempPassword);
        return;
    }

    const mailOptions = {
        from: `"Care System" <${process.env.EMAIL_FROM || 'noreply@caresystem.com'}>`,
        to: email,
        subject: 'Welcome to the Care System - Your Login Credentials',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                    .content { padding: 30px; background: #f9f9f9; }
                    .credentials { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
                    .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Care System</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${data.name},</h2>
                        <p>Your account has been created by ${data.providerName}. You can now login to the Care System using the credentials below:</p>
                        
                        <div class="credentials">
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
                        </div>
                        
                        <p>For security reasons, please change your password after your first login.</p>
                        
                        <p style="text-align: center;">
                            <a href="${data.loginUrl}" class="button">Login to Dashboard</a>
                        </p>
                        
                        <p>If you have any questions, please contact your care provider.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Care System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('Welcome email sent to:', email);
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't throw error - we don't want to break the registration flow
        console.log('Email sending failed but user was created successfully');
    }
};

// Send daily summary to provider
exports.sendDailySummary = async (email, data) => {
    if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
        console.log('DEVELOPMENT MODE: Daily summary email skipped for', email);
        return;
    }

    const mailOptions = {
        from: `"Care System" <${process.env.EMAIL_FROM || 'noreply@caresystem.com'}>`,
        to: email,
        subject: `Daily Summary - ${data.date}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                    .content { padding: 30px; background: #f9f9f9; }
                    .stats { display: flex; justify-content: space-between; margin: 20px 0; }
                    .stat-box { background: white; padding: 20px; border-radius: 5px; text-align: center; flex: 1; margin: 0 5px; }
                    .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Daily Summary</h1>
                        <p>${data.date}</p>
                    </div>
                    <div class="content">
                        <h2>Hello ${data.providerName},</h2>
                        <p>Here's your daily summary for ${data.date}:</p>
                        
                        <div class="stats">
                            <div class="stat-box">
                                <div class="stat-number">${data.completedVisits}</div>
                                <div>Completed Visits</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-number">${data.activeOperators}</div>
                                <div>Active Operators</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-number">${data.clientsSeen}</div>
                                <div>Clients Seen</div>
                            </div>
                        </div>
                        
                        <p style="margin-top: 20px;">
                            <a href="${data.dashboardUrl}" style="color: #667eea;">View full dashboard →</a>
                        </p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Care System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('Daily summary sent to:', email);
    } catch (error) {
        console.error('Error sending daily summary:', error);
    }
};