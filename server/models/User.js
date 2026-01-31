// backend/models/User.js

import { poolPromise, sql } from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

class User {
  // Fetch all active users with their roles, ConsultantName, and ClientName
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        u.UserID, 
        u.FirstName, 
        u.LastName, 
        u.Email,
        u.ConsultantID,
        u.ClientID,
        r.RoleName,
        c.FirstName AS ConsultantFirstName,
        c.LastName AS ConsultantLastName,
        cl.ClientName
      FROM Users u
      LEFT JOIN UserRoles ur ON u.UserID = ur.UserID
      LEFT JOIN Roles r ON ur.RoleID = r.RoleID
      LEFT JOIN Consultant c ON u.ConsultantID = c.ConsultantID
      LEFT JOIN Client cl ON u.ClientID = cl.ClientID
    `);
  
    // Aggregate roles per user
    const users = result.recordset.reduce((acc, user) => {
      const existing = acc.find(u => u.UserID === user.UserID);
      if (existing) {
        if (user.RoleName && !existing.Roles.includes(user.RoleName)) {
          existing.Roles.push(user.RoleName);
        }
      } else {
        acc.push({ 
          UserID: user.UserID, 
          FirstName: user.FirstName, 
          LastName: user.LastName, 
          Email: user.Email, 
          Roles: user.RoleName ? [user.RoleName] : [],
          ConsultantID: user.ConsultantID || null, // Include ConsultantID
          ConsultantName: user.ConsultantFirstName && user.ConsultantLastName 
            ? `${user.ConsultantFirstName} ${user.ConsultantLastName}` 
            : 'N/A',
          ClientID: user.ClientID || null, // Include ClientID
          ClientName: user.ClientName || 'N/A',
        });
      }
      return acc;
    }, []);
    
    return users;
  }

  // Create a new user (invited, not active yet)
  static async create(data) {
    const pool = await poolPromise;

    const userID = data.UserID || uuidv4();
    const tempPassword = uuidv4(); // Generate a random temporary password
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const createdOn = new Date();
    const updatedOn = new Date();

    // Enforce mutual exclusivity between ConsultantID and ClientID
    if (data.ConsultantID && data.ClientID) {
      throw new Error('A user cannot be both a Consultant and a Client.');
    }

    await pool.request()
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('FirstName', sql.NVarChar(50), data.FirstName)
      .input('LastName', sql.NVarChar(50), data.LastName)
      .input('Email', sql.NVarChar(255), data.Email)
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .input('IsActive', sql.Bit, 0) // User is not active until they set their password
      .input('CreatedOn', sql.DateTime, createdOn)
      .input('UpdatedOn', sql.DateTime, updatedOn)
      .input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID || null)
      .input('ClientID', sql.UniqueIdentifier, data.ClientID || null) // Add ClientID
      .query(`
        INSERT INTO Users (
          UserID, FirstName, LastName, Email, PasswordHash, IsActive, CreatedOn, UpdatedOn, ConsultantID, ClientID
        ) VALUES (
          @UserID, @FirstName, @LastName, @Email, @PasswordHash, @IsActive, @CreatedOn, @UpdatedOn, @ConsultantID, @ClientID
        );
      `);

    // Assign roles
    if (data.Roles && data.Roles.length > 0) {
      for (const roleName of data.Roles) {
        // Retrieve RoleID based on RoleName
        const roleResult = await pool.request()
          .input('RoleName', sql.NVarChar(50), roleName)
          .query(`SELECT RoleID FROM Roles WHERE RoleName = @RoleName`);
        
        if (roleResult.recordset.length === 0) {
          throw new Error(`Role "${roleName}" does not exist.`);
        }
        const roleID = roleResult.recordset[0].RoleID;

        await pool.request()
          .input('UserID', sql.UniqueIdentifier, userID)
          .input('RoleID', sql.UniqueIdentifier, roleID)
          .query(`
            INSERT INTO UserRoles (UserID, RoleID, AssignedOn)
            VALUES (@UserID, @RoleID, GETDATE())
          `);
      }
    }

    return { UserID: userID };
  }

  // Update user details and roles
  static async update(id, data) {
    const pool = await poolPromise;
    const fieldsToUpdate = [];
    const request = pool.request().input('UserID', sql.UniqueIdentifier, id);

    if (data.FirstName !== undefined) {
      fieldsToUpdate.push('FirstName = @FirstName');
      request.input('FirstName', sql.NVarChar(50), data.FirstName);
    }
    if (data.LastName !== undefined) {
      fieldsToUpdate.push('LastName = @LastName');
      request.input('LastName', sql.NVarChar(50), data.LastName);
    }
    if (data.Email !== undefined) {
      fieldsToUpdate.push('Email = @Email');
      request.input('Email', sql.NVarChar(255), data.Email);
    }
    if (data.ConsultantID !== undefined) {
      fieldsToUpdate.push('ConsultantID = @ConsultantID');
      request.input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID);
    }
    if (data.ClientID !== undefined) {
      fieldsToUpdate.push('ClientID = @ClientID');
      request.input('ClientID', sql.UniqueIdentifier, data.ClientID);
    }

    // Enforce mutual exclusivity between ConsultantID and ClientID
    if (data.ConsultantID && data.ClientID) {
      throw new Error('A user cannot be both a Consultant and a Client.');
    }

    // Always update UpdatedOn
    fieldsToUpdate.push('UpdatedOn = @UpdatedOn');
    request.input('UpdatedOn', sql.DateTime, new Date());

    if (fieldsToUpdate.length > 0) {
      await request.query(`
        UPDATE Users SET ${fieldsToUpdate.join(', ')}
        WHERE UserID = @UserID
      `);
    }

    // Update roles
    if (data.Roles) {
      // Remove existing roles
      await pool.request()
        .input('UserID', sql.UniqueIdentifier, id)
        .query(`DELETE FROM UserRoles WHERE UserID = @UserID`);

      // Assign new roles
      for (const roleName of data.Roles) {
        // Retrieve RoleID based on RoleName
        const roleResult = await pool.request()
          .input('RoleName', sql.NVarChar(50), roleName)
          .query(`SELECT RoleID FROM Roles WHERE RoleName = @RoleName`);

        if (roleResult.recordset.length === 0) {
          throw new Error(`Role "${roleName}" does not exist.`);
        }
        const roleID = roleResult.recordset[0].RoleID;

        await pool.request()
          .input('UserID', sql.UniqueIdentifier, id)
          .input('RoleID', sql.UniqueIdentifier, roleID)
          .query(`
            INSERT INTO UserRoles (UserID, RoleID, AssignedOn)
            VALUES (@UserID, @RoleID, GETDATE())
          `);
      }
    }

    return { message: 'User updated successfully.' };
  }

  // Delete a user and their roles
  static async delete(id) {
    const pool = await poolPromise;
    await pool.request()
      .input('UserID', sql.UniqueIdentifier, id)
      .query(`DELETE FROM UserRoles WHERE UserID = @UserID`);
    await pool.request()
      .input('UserID', sql.UniqueIdentifier, id)
      .query(`DELETE FROM Users WHERE UserID = @UserID`);
    return { message: 'User deleted successfully.' };
  }

  // Retrieve a user by ID with roles, ConsultantName, and ClientName
  static async getById(userId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserID', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          u.UserID, 
          u.FirstName, 
          u.LastName, 
          u.Email,
          u.ConsultantID,
          u.ClientID,
          r.RoleName,
          c.FirstName AS ConsultantFirstName,
          c.LastName AS ConsultantLastName,
          cl.ClientName
        FROM Users u
        LEFT JOIN UserRoles ur ON u.UserID = ur.UserID
        LEFT JOIN Roles r ON ur.RoleID = r.RoleID
        LEFT JOIN Consultant c ON u.ConsultantID = c.ConsultantID
        LEFT JOIN Client cl ON u.ClientID = cl.ClientID
        WHERE u.UserID = @UserID
      `);

    if (result.recordset.length === 0) return null;

    const user = result.recordset[0];
    const roles = result.recordset
      .filter(record => record.RoleName)
      .map(record => record.RoleName);

    const consultantName = user.ConsultantFirstName && user.ConsultantLastName
      ? `${user.ConsultantFirstName} ${user.ConsultantLastName}`
      : '';

    const clientName = user.ClientName || '';

    return {
      UserID: user.UserID,
      FirstName: user.FirstName,
      LastName: user.LastName,
      Email: user.Email,
      ConsultantID: user.ConsultantID,
      ClientID: user.ClientID,
      Roles: roles,
      ConsultantName: consultantName,
      ClientName: clientName,
    };
  }

  // Send an invitation to a user
  static async sendInvite(userId) {
    const pool = await poolPromise;
    const user = await this.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate a unique invite token
    const inviteToken = uuidv4();
    const hashedToken = await bcrypt.hash(inviteToken, 10);

    // Update user with inviteToken and set IsActive to 0
    await pool.request()
      .input('UserID', sql.UniqueIdentifier, userId)
      .input('InviteToken', sql.NVarChar(255), hashedToken)
      .query(`
        UPDATE Users 
        SET InviteToken = @InviteToken, IsActive = 0, UpdatedOn = GETDATE()
        WHERE UserID = @UserID
      `);

    // Return the plain token to include in the invite link
    return inviteToken;
  }

  // Set password using invite token
  static async setPassword(inviteToken, password) {
    const pool = await poolPromise;

    // Retrieve all users with an invite token
    const result = await pool.request()
      .query(`
        SELECT 
          u.UserID,
          u.InviteToken
        FROM Users u
        WHERE u.IsActive = 0 AND u.InviteToken IS NOT NULL
      `);

    const users = result.recordset;

    // Find the user with the matching invite token
    let user = null;
    for (const u of users) {
      const match = await bcrypt.compare(inviteToken, u.InviteToken);
      if (match) {
        user = u;
        break;
      }
    }

    if (!user) {
      throw new Error('Invalid or expired invite token.');
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user's password, set IsActive to 1, and remove InviteToken
    await pool.request()
      .input('UserID', sql.UniqueIdentifier, user.UserID)
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .query(`
        UPDATE Users
        SET PasswordHash = @PasswordHash, IsActive = 1, InviteToken = NULL, UpdatedOn = GETDATE()
        WHERE UserID = @UserID
      `);

    return user.UserID;
  }

  // Authenticate user and generate JWT
  static async login(email, password) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .query(`
        SELECT 
          u.UserID,
          u.PasswordHash,
          u.Email,
          u.FirstName,
          u.LastName,
          u.ConsultantID,
          u.ClientID,
          r.RoleName
        FROM Users u
        LEFT JOIN UserRoles ur ON u.UserID = ur.UserID
        LEFT JOIN Roles r ON ur.RoleID = r.RoleID
        WHERE u.Email = @Email AND u.IsActive = 1
      `);

    if (result.recordset.length === 0) {
      throw new Error('Invalid email or password.');
    }

    const user = result.recordset[0];
    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch) {
      throw new Error('Invalid email or password.');
    }

    // Collect roles
    const roles = result.recordset
      .filter(record => record.RoleName)
      .map(record => record.RoleName);

    // Generate JWT
    const tokenPayload = {
      userId: user.UserID,
      email: user.Email,
      roles: roles,
      consultantId: user.ConsultantID || null,
      clientId: user.ClientID || null,
    };

    // Increase token expiration to 24 hours for better UX
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return token;
  }
}

export default User;
