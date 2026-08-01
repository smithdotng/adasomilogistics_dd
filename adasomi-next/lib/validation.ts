import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(1, 'Password is required.')
});

export const registerSchema = z.object({
    firstName: z.string().trim().min(1, 'First name is required.'),
    lastName: z.string().trim().min(1, 'Last name is required.'),
    email: z.string().email('Enter a valid email address.'),
    phone: z.string().trim().min(1, 'Phone number is required.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    role: z.enum(['merchant', 'rider', 'public_user'], { errorMap: () => ({ message: 'Select a valid account type.' }) }),
    businessName: z.string().trim().optional(),
    businessType: z.enum(['food_processor', 'food_vendor', 'restaurant', 'produce_aggregator']).optional(),
    address: z.string().trim().optional(),
    licenseNumber: z.string().trim().optional(),
    vehicleType: z.enum(['dispatch_bike', 'bicycle', 'car', 'van']).optional(),
    vehiclePlate: z.string().trim().optional(),
    kycNotes: z.string().trim().optional()
});

export const resendVerificationSchema = z.object({
    email: z.string().email('Enter a valid email address.')
});
