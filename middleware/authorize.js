module.exports = async (req, res, next) => {
  if (!req.session || !req.session.officeId) {
    res.json({error: 'Not logged in'})
  }
  else {
    next()
  }
}