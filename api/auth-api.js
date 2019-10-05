const databaseFacade = require('../utils/databaseFacade')
const bcrypt = require('bcrypt')


module.exports = {
  setupRoutes () {
    app.post('/login', async (req, res) => {
      let result = await this.login(req.body.password, req.body.officeId)
      req.session.officeId = req.body.officeId
      res.json(result)
    })
  },

  async login (password, officeId) {
    try {
      let loginQuery = 'SELECT * FROM office WHERE id = ?'
      let loginQueryParams = [officeId]
      let officeData = await databaseFacade.execute(loginQuery, loginQueryParams)

      if (officeData.length === 0) {
        return {'error': 'Incorrect office id'}
      }

      // todo ragnar bare midlertidig, fjerne etterhvert
      if (!officeData[0].password) {
        await this.generatePasswordForExistingOffice(officeId)
        return this.login('dips', officeId)
      }

      let passwordMatch = await bcrypt.compare(password, officeData[0].password)
      if (!passwordMatch) {
        return {'error': 'Incorrect password'}
        
        // await this.generatePasswordForExistingOffice(officeId)
        // return this.login('dips', officeId)
      }

      return {success: true}
    }
    catch (err) {
      return {'error': 'Server errror'}
    }
  },

  async signup (officeName, password, passwordHint) {
    let hashedPassword = await bcrypt.hash(password, 8)
    let insertQuery = 'INSERT INTO office (name, password, passwordhint) VALUES (?, ?, ?)'
    let insertQueryParams = [officeName, hashedPassword, passwordHint]
    await databaseFacade.execute(insertQuery, insertQueryParams)
  },

  async updateOffice (officeId, newName, currentPassword, newPassword, passwordHint) {
    let getOfficeQuery = 'SELECT * FROM office WHERE id = ?'
    let officeData = await databaseFacade.execute(getOfficeQuery, [officeId])
    let passwordMatch = await bcrypt.compare(currentPassword, officeData[0].password)
    if (!passwordMatch) { return {error: 'Wrong old password'} }

    let updateQuery, updateQueryParams
    if (newPassword) {
      if (!newPassword.length > 4) { return {error: 'Password must be at least 4 characters long'} }
      let hashedPassword = await bcrypt.hash(newPassword, 8)
      updateQuery = 'UPDATE office SET name = ?, password = ?, passwordHint = ? WHERE id = ?'
      updateQueryParams = [newName, hashedPassword, passwordHint, officeId]
    }
    else {
      updateQuery = 'UPDATE office SET name = ?, passwordHint = ? WHERE id = ?'
      updateQueryParams = [newName, passwordHint, officeId]
    }

    await databaseFacade.execute(updateQuery, updateQueryParams)
    return {success: true}
  },
 
  // todo ragnar kan fjerne etterhvert
  async generatePasswordForExistingOffice (officeId) {
    let standardPassword = await bcrypt.hash('dips', 8)
    let query = 'UPDATE office SET password = ? WHERE id = ?'
    let queryParams = [standardPassword, officeId]
    await databaseFacade.execute(query, queryParams)
  }
}