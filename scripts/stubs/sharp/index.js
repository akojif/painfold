// Painfold never processes images. See package.json.
module.exports = function sharp() {
  throw new Error('sharp is not available in Painfold: image models are not used.')
}
