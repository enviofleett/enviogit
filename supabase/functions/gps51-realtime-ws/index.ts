
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectedClient {
  socket: WebSocket;
  userId: string;
  lastSeen: Date;
  subscribedVehicles: Set<string>;
}

const connectedClients = new Map<string, ConnectedClient>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  const clientId = crypto.randomUUID();
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`WebSocket client connected: ${clientId}`);

  socket.onopen = () => {
    console.log(`WebSocket opened for client: ${clientId}`);
    socket.send(JSON.stringify({
      type: 'connection_established',
      clientId,
      timestamp: new Date().toISOString()
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log(`Received message from ${clientId}:`, message);

      switch (message.type) {
        case 'subscribe_vehicles':
          const client = connectedClients.get(clientId);
          if (client) {
            client.subscribedVehicles = new Set(message.vehicleIds || []);
            client.lastSeen = new Date();
          }
          socket.send(JSON.stringify({
            type: 'subscription_confirmed',
            vehicleIds: message.vehicleIds,
            timestamp: new Date().toISOString()
          }));
          break;

        case 'ping':
          const clientData = connectedClients.get(clientId);
          if (clientData) {
            clientData.lastSeen = new Date();
          }
          socket.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;

        case 'request_vehicle_update':
          // Trigger immediate sync for specific vehicles
          if (message.vehicleIds && Array.isArray(message.vehicleIds)) {
            await triggerVehicleSync(message.vehicleIds, supabase);
            socket.send(JSON.stringify({
              type: 'sync_triggered',
              vehicleIds: message.vehicleIds,
              timestamp: new Date().toISOString()
            }));
          }
          break;
      }
    } catch (error) {
      console.error(`Error processing message from ${clientId}:`, error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  };

  socket.onclose = () => {
    console.log(`WebSocket closed for client: ${clientId}`);
    connectedClients.delete(clientId);
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    connectedClients.delete(clientId);
  };

  // Add client to connected clients map
  connectedClients.set(clientId, {
    socket,
    userId: 'anonymous', // Will be updated when user authenticates
    lastSeen: new Date(),
    subscribedVehicles: new Set()
  });

  return response;
});

async function triggerVehicleSync(vehicleIds: string[], supabase: any) {
  try {
    // Get GPS51 credentials and trigger priority sync for specific vehicles
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('gps51_device_id, license_plate')
      .in('id', vehicleIds)
      .not('gps51_device_id', 'is', null);

    if (vehicles && vehicles.length > 0) {
      console.log(`Triggering priority sync for ${vehicles.length} vehicles`);
      
      // This would typically call the GPS51 sync with priority filtering
      const { error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          priority: 1, // High priority
          batchMode: true,
          cronTriggered: false,
          specificVehicles: vehicles.map((v: any) => v.gps51_device_id)
        }
      });

      if (error) {
        console.error('Error triggering vehicle sync:', error);
      }
    }
  } catch (error) {
    console.error('Error in triggerVehicleSync:', error);
  }
}

// Broadcast position updates to connected clients
export function broadcastPositionUpdate(vehicleId: string, position: any) {
  const message = JSON.stringify({
    type: 'position_update',
    vehicleId,
    position,
    timestamp: new Date().toISOString()
  });

  connectedClients.forEach((client, clientId) => {
    if (client.subscribedVehicles.has(vehicleId) || client.subscribedVehicles.size === 0) {
      try {
        client.socket.send(message);
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        connectedClients.delete(clientId);
      }
    }
  });
}

// Clean up inactive connections
setInterval(() => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  connectedClients.forEach((client, clientId) => {
    if (client.lastSeen < fiveMinutesAgo) {
      console.log(`Removing inactive client: ${clientId}`);
      try {
        client.socket.close();
      } catch (error) {
        console.error(`Error closing socket for ${clientId}:`, error);
      }
      connectedClients.delete(clientId);
    }
  });
}, 60000); // Check every minute
