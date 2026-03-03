const nodemailer = require('nodemailer');

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Create transporter with better configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
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
if (!isDevelopment) {
    transporter.verify(function(error, success) {
        if (error) {
            console.log('Email server connection error:', error);
            console.log('Email functionality will be disabled. Check your .env configuration.');
        } else {
            console.log('Email server is ready to send messages');
        }
    });
}

// Send welcome email to new client
exports.sendClientCredentials = async (email, tempPassword, data) => {
    // In development, just log the credentials
    if (isDevelopment || !process.env.EMAIL_USER) {
        console.log('==========================================');
        console.log('DEVELOPMENT MODE: New Client Account Created');
        console.log('Email:', email);
        console.log('Temporary Password:', tempPassword);
        console.log('Login URL:', data.loginUrl);
        console.log('==========================================');
        return { success: true, devMode: true };
    }

    const mailOptions = {
        from: `"Care System" <${process.env.EMAIL_FROM || 'noreply@caresystem.com'}>`,
        to: email,
        subject: 'Welcome to Care System - Your Account Has Been Created',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
                    .credentials { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
                    .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: 500; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                    .warning { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 10px; border-radius: 5px; margin: 20px 0; }
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
                        
                        <div class="warning">
                            <strong>⚠️ Important:</strong> For security reasons, please change your password after your first login.
                        </div>
                        
                        <p style="text-align: center; margin-top: 30px;">
                            <a href="${data.loginUrl}" class="button">Login to Your Dashboard</a>
                        </p>
                        
                        <p style="margin-top: 30px;">If you have any questions, please contact your care provider.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Care System. All rights reserved.</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Welcome email sent to client:', email);
        console.log('Message ID:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending welcome email to client:', error);
        // Don't throw error - we don't want to break the registration flow
        console.log('Email sending failed but client was created successfully');
        return { success: false, error: error.message };
    }
};

// Send welcome email to new operator
exports.sendOperatorCredentials = async (email, tempPassword, data) => {
    if (isDevelopment || !process.env.EMAIL_USER) {
        console.log('==========================================');
        console.log('DEVELOPMENT MODE: New Operator Account Created');
        console.log('Email:', email);
        console.log('Temporary Password:', tempPassword);
        console.log('Login URL:', data.loginUrl);
        console.log('==========================================');
        return { success: true, devMode: true };
    }

    const mailOptions = {
        from: `"Care System" <${process.env.EMAIL_FROM || 'noreply@caresystem.com'}>`,
        to: email,
        subject: 'Welcome to Care System - Your Operator Account',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
                    .credentials { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
                    .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to the Care Team</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${data.name},</h2>
                        <p>Your operator account has been created by ${data.providerName}. You can now login to the Care System using the credentials below:</p>
                        
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
        console.log('Welcome email sent to operator:', email);
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

// Send daily summary to provider
exports.sendDailySummary = async (email, data) => {
    if (isDevelopment || !process.env.EMAIL_USER) {
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

// Test email configuration
exports.testEmailConfig = async () => {
    if (!process.env.EMAIL_USER) {
        return { 
            success: false, 
            message: 'Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS in .env file.' 
        };
    }
    
    try {
        await transporter.verify();
        return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
        return { success: false, message: error.message };
    }
};