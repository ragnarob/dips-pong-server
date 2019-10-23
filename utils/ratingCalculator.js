module.exports = calculateFunctions = {
  'Standard elo': function (winnerElo, loserElo) {
    const k = 32

    let P1 = (1.0 / (1.0 + 10**((winnerElo - loserElo) / 400)))

    let ratingTransferred = Math.round(k*(P1))
    
    return ratingTransferred
  },

  'SmallUpset elo': function (winnerElo, loserElo) {
    if (winnerElo >= loserElo) {
      return calculateFunctions['Standard elo'](winnerElo, loserElo)
    }
    const k = 32
    const a = 400
    const t = 14
    const w = 0.0027

    let diff = loserElo - winnerElo
    let ratingTransferred = Math.round(k - (k)/(1 + t**(diff/a)) + (w * diff**1.91)/(k))
    
    return ratingTransferred
  },

  'Upset elo': function (winnerElo, loserElo) {
    if (winnerElo >= loserElo) {
      return calculateFunctions['Standard elo'](winnerElo, loserElo)
    }
    const k = 32
    const a = 400
    const t = 14
    const w = 0.0027

    let diff = loserElo - winnerElo
    let ratingTransferred = Math.round(k - (k)/(1 + t**(diff/a)) + (w * diff**2)/(k))
    
    return ratingTransferred
  },
}
