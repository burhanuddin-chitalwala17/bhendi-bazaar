/**
 * Seed data for Users and Profiles
 * Password for all users: "Test@123"
 */

import type { SeedUser } from "./types";

export const seedUsers: SeedUser[] = [
  // ADMIN USERS
  {
    id: "user-admin-1",
    email: "admin@bhendibazaar.com",
    name: "Burhanuddin Chitalwala",
    passwordPlain: "Admin@123",
    passwordHash: "", // Will be hashed in seed script
    platformRole: "ADMIN",
    mobile: "+918452959340",
    isEmailVerified: true,
    profile: {
      addresses: [
        {
          id: "addr-admin-1-1",
          label: "Home",
          fullName: "Burhanuddin Chitalwala",
          mobile: "+918452959340",
          addressLine1: "Shop No. 45, Bhendi Bazaar",
          addressLine2: "Mohammad Ali Road",
          landmark: "Near Minara Masjid",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400003",
          isDefault: true,
        },
      ],
      profilePic: null, // Will be set after upload
    },
  },
  {
    id: "user-admin-2",
    email: "admin1@123.com",
    name: "Farida Chitalwala",
    passwordPlain: "Admin@123",
    passwordHash: "",
    platformRole: "ADMIN",
    mobile: "+919876543211",
    isEmailVerified: true,
    profile: {
      addresses: [
        {
          id: "addr-admin-2-1",
          label: "Office",
          fullName: "Farida Chitalwala",
          mobile: "+919876543211",
          addressLine1: "Building 12, Clare Road",
          addressLine2: "Byculla East",
          landmark: "Near Gloria Church",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400008",
          isDefault: true,
        },
      ],
      profilePic: null,
    },
  },

  // REGULAR USERS
  {
    id: "user-1",
    email: "abbas.chitalwala@jimail.com",
    name: "Abbas Chitalwala",
    passwordPlain: "Test@123",
    passwordHash: "",
    platformRole: "USER",
    mobile: "+919123456789",
    isEmailVerified: true,
    profile: {
      addresses: [
        {
          id: "addr-1-1",
          label: "Home",
          fullName: "Abbas Chitalwala",
          mobile: "+919123456789",
          addressLine1: "Flat 304, Aisha Apartments",
          addressLine2: "Nagpada Junction",
          landmark: "Near Agripada Police Station",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400008",
          isDefault: true,
        },
        {
          id: "addr-1-2",
          label: "Work",
          fullName: "Abbas Chitalwala",
          mobile: "+919123456789",
          addressLine1: "Office 501, BKC Tower",
          addressLine2: "Bandra Kurla Complex",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400051",
          isDefault: false,
        },
      ],
      profilePic: null,
    },
  },
  {
    id: "user-2",
    email: "mariya.dhar@yahooo.com",
    name: "Mariya Dhar",
    passwordPlain: "Test@123",
    passwordHash: "",
    platformRole: "USER",
    mobile: "+919234567890",
    isEmailVerified: true,
    profile: {
      addresses: [
        {
          id: "addr-2-1",
          label: "Home",
          fullName: "Mariya Dhar",
          mobile: "+919234567890",
          addressLine1: "201, Zara Heights",
          addressLine2: "Dongri Street",
          landmark: "Opposite Makhdoom Shah Baba Dargah",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400009",
          isDefault: true,
        },
      ],
      profilePic: null,
    },
  },
  {
    id: "user-3",
    email: "test@123.com",
    name: "Tasneem Chitalwala",
    passwordPlain: "Test@123",
    passwordHash: "",
    platformRole: "USER",
    mobile: "+919345678901",
    isEmailVerified: false, // Testing unverified email flow
    profile: {
      addresses: [
        {
          id: "addr-3-1",
          label: "Home",
          fullName: "Tasneem Chitalwala",
          mobile: "+919345678901",
          addressLine1: "Flat B-702, Gulshan Towers",
          addressLine2: "Clare Road, Byculla",
          landmark: "Near Byculla Railway Station",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400027",
          isDefault: true,
        },
      ],
      profilePic: null,
    },
  },
];

