Array.prototype.asyncForEach = async function(fn) {
  for (let i = 0; i < this.length; i++) {
    await fn(this[i])
  }
}
