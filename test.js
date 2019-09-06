const tape = require('tape')
const SMC = require('./')

tape('basic', function (t) {
  const a = new SMC({
    onmessage (channel, type, message) {
      t.same(channel, 0)
      t.same(type, 1)
      t.same(message, Buffer.from('hi'))
      t.end()
    }
  })

  a.recv(a.send(0, 1, Buffer.from('hi')))
})

tape('basic chunked', function (t) {
  const a = new SMC({
    onmessage (channel, type, message) {
      t.same(channel, 0)
      t.same(type, 1)
      t.same(message, Buffer.from('hi'))
      t.end()
    }
  })

  const payload = a.send(0, 1, Buffer.from('hi'))

  for (let i = 0; i < payload.length; i++) {
    a.recv(payload.slice(i, i + 1))
  }
})

tape('two messages chunked', function (t) {
  t.plan(6)

  const expected = [
    [0, 1, Buffer.from('hi')],
    [42, 3, Buffer.from('hey')]
  ]

  const a = new SMC({
    onmessage (channel, type, message) {
      const e = expected.shift()
      t.same(channel, e[0])
      t.same(type, e[1])
      t.same(message, e[2])
    }
  })

  const payload = a.send(0, 1, Buffer.from('hi'))

  for (let i = 0; i < payload.length; i++) {
    a.recv(payload.slice(i, i + 1))
  }

  const payload2 = a.send(42, 3, Buffer.from('hey'))

  for (let i = 0; i < payload2.length; i++) {
    a.recv(payload2.slice(i, i + 1))
  }
})

tape('empty message', function (t) {
  const a = new SMC({
    onmessage (channel, type, message) {
      t.same(channel, 0)
      t.same(type, 0)
      t.same(message, Buffer.alloc(0))
      t.end()
    }
  })

  a.recv(a.send(0, 0, Buffer.alloc(0)))
})
