
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const upgrade = req.headers.get('upgrade') || ''
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket connection', { status: 400 })
    }

    const { socket, response } = Deno.upgradeWebSocket(req)
    
    console.log('WebSocket connection established')
    
    socket.onopen = () => {
      console.log('WebSocket opened')
      socket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString()
      }))
    }
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('WebSocket message received:', message)
        
        switch (message.type) {
          case 'subscribe':
            // Handle vehicle subscription
            if (message.vehicleIds && Array.isArray(message.vehicleIds)) {
              console.log('Subscribing to vehicles:', message.vehicleIds)
              socket.send(JSON.stringify({
                type: 'subscribed',
                vehicleIds: message.vehicleIds,
                timestamp: new Date().toISOString()
              }))
            }
            break
            
          case 'requestUpdate':
            // Handle priority update request
            if (message.vehicleIds && Array.isArray(message.vehicleIds)) {
              console.log('Priority update requested for vehicles:', message.vehicleIds)
              // In a real implementation, this would trigger GPS51 API calls
              socket.send(JSON.stringify({
                type: 'updateRequested',
                vehicleIds: message.vehicleIds,
                timestamp: new Date().toISOString()
              }))
            }
            break
            
          case 'ping':
            socket.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }))
            break
            
          default:
            console.log('Unknown message type:', message.type)
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error)
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }))
      }
    }
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    socket.onclose = () => {
      console.log('WebSocket connection closed')
    }
    
    return response
  } catch (error) {
    console.error('WebSocket setup error:', error)
    return new Response('WebSocket setup failed', { status: 500 })
  }
})
