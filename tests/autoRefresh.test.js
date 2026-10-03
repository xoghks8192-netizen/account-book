import test from 'node:test'
import assert from 'node:assert/strict'
import { canAutoRefresh } from '../src/hooks/useAutoRefresh.js'

test('automatic refresh pauses when hidden, editing, or typing', () => {
  const doc = { visibilityState:'visible', querySelector:()=>null, activeElement:{matches:()=>false} }
  assert.equal(canAutoRefresh(doc),true)
  assert.equal(canAutoRefresh({...doc,visibilityState:'hidden'}),false)
  assert.equal(canAutoRefresh({...doc,querySelector:()=>({})}),false)
  assert.equal(canAutoRefresh({...doc,activeElement:{matches:()=>true}}),false)
})
