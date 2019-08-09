const varint = require('varint')

module.exports = class SimpleMessageChannels {
  constructor ({ maxSize = 8 * 1024 * 1024, context = null, onmessage = null } = {}) {
    this._message = null
    this._ptr = 0
    this._varint = 0
    this._factor = 1
    this._length = 0
    this._header = 0
    this._state = 0
    this._consumed = 0
    this._maxSize = maxSize

    this.destroyed = false
    this.error = null
    this.context = context
    this.onmessage = onmessage
  }

  destroy (err) {
    if (err) this.error = err
    this.destroyed = true
  }

  recv (data) {
    let offset = 0
    while (offset < data.length) {
      if (this._state === 2) offset = this._readMessage(data, offset)
      else offset = this._readVarint(data, offset)
    }
    return !this.destroyed
  }

  _readMessage (data, offset) {
    const free = data.length - offset
    if (free >= this._length) {
      if (this._message) {
        data.copy(this._message, this._message.length - this._length)
      } else {
        this._message = data.slice(offset, offset + this._length)
      }
      return this._nextState() ? offset + this._length : data.length
    }

    if (!this._message) this._message = Buffer.allocUnsafe(this._length)
    data.copy(this._message, this._message.length - this._length)
    this._length -= data.length

    return data.length
  }

  _readVarint (data, offset) {
    for (; offset < data.length; offset++) {
      this._varint += (data[offset] & 127) * this._factor
      this._consumed++
      if (data[offset] < 128) return this._nextState() ? offset + 1 : data.length
      this._factor *= 128
    }
    if (this._consumed >= 8) this.destroy(new Error('Incoming varint is invalid')) // 8 * 7bits is 56 ie max for js
    return data.length
  }

  _nextState () {
    switch (this._state) {
      case 0:
        this._state = 1
        this._factor = 1
        this._length = this._varint
        this._consumed = this._varint = 0
        return true

      case 1:
        this._state = 2
        this._factor = 1
        this._header = this._varint
        this._length -= this._consumed
        this._consumed = this._varint = 0
        if (this._length < 0 || this._length > this._maxSize) {
          this.destroy(new Error('Incoming message is larger than max size'))
          return false
        }
        return true

      case 2:
        this._state = 0
        if (this.onmessage !== null) this.onmessage(this._header >> 4, this._header & 0b1111, this._message, this.context)
        this._message = null
        return !this.destroyed

      default:
        return false
    }
  }

  send (channel, type, message) {
    const header = channel << 4 | type
    const length = message.length + varint.encodingLength(header)
    const payload = Buffer.allocUnsafe(varint.encodingLength(length) + length)

    varint.encode(length, payload, 0)
    const offset = varint.encode.bytes
    varint.encode(header, payload, offset)
    message.copy(payload, offset + varint.encode.bytes)

    return payload
  }

  sendBatch (messages) {
    let length = 0
    let offset = 0

    for (const m of messages) {
      // 16 is >= the max size of the varints
      length += 16 + m.message.length
    }

    const payload = Buffer.allocUnsafe(length)

    for (const { channel, type, message } of messages) {
      const header = channel << 4 | type
      const length = message.length + varint.encodingLength(header)
      varint.encode(length, payload, offset)
      offset += varint.encode.bytes
      varint.encode(header, payload, offset)
      offset += varint.encode.bytes
      message.copy(payload, offset)
      offset += message.length
    }

    return payload.slice(0, offset)
  }
}
