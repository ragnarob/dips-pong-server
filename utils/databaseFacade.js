const mysql = require('mysql')
const databaseSettings = require('../config/settings.json').databaseSettings

module.exports = {
  mysqlPool: mysql.createPool(databaseSettings),

	async execute (queryString, queryParams) {
		return new Promise (async (resolve, reject) => {
			this.mysqlPool.getConnection((err, connection) => {
				if (err) {
          reject('Error establishing database connection')
        }
        
				else if (queryParams) {
					connection.query(queryString, queryParams, (err, results) => {
            connection.release()
            if (err) {
              reject(err.message)
            }
            else {
              resolve(results)
            }
					})
        }
        
				else {
					connection.query(queryString, (err, results) => {
            connection.release()
            if (err) {
              reject(err.message)
            }
            else {
              resolve(results)
            }
          })
				}
			})
		})
	}
}