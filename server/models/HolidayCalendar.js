import { poolPromise, sql } from '../db.js';

class HolidayCalendar {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT HolidayDate, HolidayName
      FROM HolidayCalendar
      ORDER BY HolidayDate
    `);
    return result.recordset;
  }

  static async add({ holidayDate, holidayName }) {
    const pool = await poolPromise;

    // Idempotent insert
    await pool.request()
      .input('HolidayDate', sql.Date, holidayDate)
      .input('HolidayName', sql.NVarChar(200), holidayName)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM HolidayCalendar WHERE HolidayDate = @HolidayDate)
        BEGIN
          INSERT INTO HolidayCalendar (HolidayDate, HolidayName)
          VALUES (@HolidayDate, @HolidayName)
        END
        ELSE
        BEGIN
          UPDATE HolidayCalendar
          SET HolidayName = @HolidayName
          WHERE HolidayDate = @HolidayDate
        END
      `);

    const after = await pool.request()
      .input('HolidayDate', sql.Date, holidayDate)
      .query(`
        SELECT HolidayDate, HolidayName
        FROM HolidayCalendar
        WHERE HolidayDate = @HolidayDate
      `);

    return after.recordset[0];
  }

  static async remove(holidayDate) {
    const pool = await poolPromise;
    await pool.request()
      .input('HolidayDate', sql.Date, holidayDate)
      .query(`DELETE FROM HolidayCalendar WHERE HolidayDate = @HolidayDate`);
  }
}

export default HolidayCalendar;
