import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSecurity, PRODUCTION_SECURITY_CONFIG } from "../_shared/security.ts";

interface VehicleManagementRequest {
  action: 'add_vehicle' | 'engine_control' | 'get_audit' | 'get_connection_status';
  // Add vehicle fields
  device_type_id?: string;
  system_id?: string;
  device_sim_number?: string;
  plate_number?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  color?: string;
  chassis_number?: string;
  user_id?: string;
  // Engine control fields
  vehicle_id?: string;
  command?: 'shutdown' | 'enable';
  device_id?: string;
}

const secureHandler = async (req: Request): Promise<Response> => {
  try {
    const body: VehicleManagementRequest = await req.json();
    const { action } = body;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated partner
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    const { data: partner, error: partnerError } = await supabaseClient
      .from('technical_partners')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (partnerError || !partner || partner.status !== 'approved') {
      throw new Error('Partner not found or not approved');
    }

    switch (action) {
      case 'add_vehicle':
        return await handleAddVehicle(supabaseClient, partner.id, body);
      case 'engine_control':
        return await handleEngineControl(supabaseClient, partner.id, body);
      case 'get_audit':
        return await handleGetAudit(supabaseClient, partner.id, body);
      case 'get_connection_status':
        return await handleGetConnectionStatus(supabaseClient, partner.id);
      default:
        throw new Error('Invalid action');
    }
  } catch (error: any) {
    console.error("Vehicle Management Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      success: false 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

async function handleAddVehicle(supabaseClient: any, partnerId: string, body: VehicleManagementRequest) {
  const { device_type_id, system_id, device_sim_number, plate_number, vehicle_brand, vehicle_model, color, chassis_number, user_id } = body;

  if (!device_type_id || !system_id || !device_sim_number || !plate_number || !user_id) {
    throw new Error('Missing required fields for vehicle addition');
  }

  console.log('Adding vehicle for partner:', partnerId);

  // Get device type details
  const { data: deviceType, error: deviceTypeError } = await supabaseClient
    .from('device_types')
    .select('*')
    .eq('id', device_type_id)
    .single();

  if (deviceTypeError || !deviceType) {
    throw new Error('Invalid device type');
  }

  // Check if partner has sufficient wallet balance
  const { data: wallet, error: walletError } = await supabaseClient
    .from('partner_wallets')
    .select('*')
    .eq('technical_partner_id', partnerId)
    .single();

  if (walletError || !wallet) {
    throw new Error('Partner wallet not found');
  }

  const activationFee = parseFloat(deviceType.activation_fee_amount.toString());
  const currentBalance = parseFloat(wallet.current_balance.toString());

  if (currentBalance < activationFee) {
    throw new Error(`Insufficient wallet balance. Required: ₦${activationFee.toFixed(2)}, Available: ₦${currentBalance.toFixed(2)}`);
  }

  // Create vehicle record
  const { data: vehicle, error: vehicleError } = await supabaseClient
    .from('vehicles')
    .insert({
      subscriber_id: user_id,
      make: vehicle_brand,
      model: vehicle_model,
      plate: plate_number,
      license_plate: plate_number,
      brand: vehicle_brand,
      type: deviceType.name,
      notes: `Added by technical partner. Device: ${system_id}`,
      gps51_device_id: system_id,
      status: 'pending_activation'
    })
    .select()
    .single();

  if (vehicleError) {
    throw new Error(`Failed to create vehicle: ${vehicleError.message}`);
  }

  // Create activation audit record
  const { data: auditRecord, error: auditError } = await supabaseClient
    .from('vehicle_activation_audit')
    .insert({
      vehicle_id: vehicle.id,
      technical_partner_id: partnerId,
      device_type_id,
      system_id,
      activation_fee_charged: activationFee,
      status: 'pending'
    })
    .select()
    .single();

  if (auditError) {
    console.error('Failed to create audit record:', auditError);
  }

  // Generate configuration SMS
  const smsTemplate = deviceType.configuration_sms_template;
  const configSMS = smsTemplate
    .replace('{GSM_NETWORK}', 'MTN') // Default network
    .replace('{APN}', 'web.gprs.mtnnigeria.net') // Default APN
    .replace('{IMEI}', system_id)
    .replace('{SIM_NUMBER}', device_sim_number);

  console.log('Generated configuration SMS:', configSMS);

  // Send configuration SMS via GPS51
  let smsSuccess = false;
  let smsResponse = '';
  try {
    const { data: smsResult, error: smsError } = await supabaseClient.functions.invoke('gps51-proxy', {
      body: {
        action: 'setcommand',
        params: {
          deviceid: system_id,
          cmd: 'config',
          param: configSMS
        },
        method: 'POST'
      }
    });

    if (smsError) {
      smsResponse = `SMS Error: ${smsError.message}`;
      console.error('SMS sending failed:', smsError);
    } else if (smsResult?.status === 0) {
      smsSuccess = true;
      smsResponse = 'Configuration SMS sent successfully';
      console.log('Configuration SMS sent successfully');
    } else {
      smsResponse = smsResult?.message || 'SMS sending failed';
      console.error('SMS sending failed:', smsResult);
    }
  } catch (error) {
    smsResponse = `SMS Exception: ${error.message}`;
    console.error('SMS sending exception:', error);
  }

  // Update audit record with SMS result
  await supabaseClient
    .from('vehicle_activation_audit')
    .update({
      sms_sent: smsSuccess,
      sms_response: smsResponse
    })
    .eq('id', auditRecord.id);

  // Wait 60 seconds then check initial position
  setTimeout(async () => {
    await checkInitialPosition(supabaseClient, auditRecord.id, system_id);
  }, 60000);

  // Debit wallet for activation fee
  const { error: debitError } = await supabaseClient.functions.invoke('partner-wallet-operation', {
    body: {
      operation: 'debit',
      technical_partner_id: partnerId,
      amount: activationFee,
      description: `Vehicle activation fee - ${plate_number}`,
      reference: `activation_${vehicle.id}`
    }
  });

  if (debitError) {
    console.error('Failed to debit wallet:', debitError);
    // Continue anyway as vehicle was created
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Vehicle added successfully. Configuration SMS sent.',
    vehicle: {
      id: vehicle.id,
      plate_number,
      system_id,
      device_type: deviceType.name,
      activation_fee: activationFee,
      sms_sent: smsSuccess,
      sms_response: smsResponse
    }
  }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
}

async function checkInitialPosition(supabaseClient: any, auditId: string, systemId: string) {
  console.log('Checking initial position for device:', systemId);

  try {
    const { data: positionResult, error: positionError } = await supabaseClient.functions.invoke('gps51-proxy', {
      body: {
        action: 'lastposition',
        params: {
          deviceid: systemId
        },
        method: 'POST'
      }
    });

    let positionSuccess = false;
    let positionResponse = {};
    let status = 'failed';

    if (positionError) {
      positionResponse = { error: positionError.message };
    } else if (positionResult?.status === 0 && positionResult?.data) {
      positionSuccess = true;
      positionResponse = positionResult.data;
      status = 'success';
      console.log('Initial position fetched successfully');
    } else {
      positionResponse = { error: positionResult?.message || 'Position fetch failed' };
    }

    // Update audit record
    await supabaseClient
      .from('vehicle_activation_audit')
      .update({
        initial_position_fetched: positionSuccess,
        initial_position_response: positionResponse,
        status,
        completed_at: new Date().toISOString()
      })
      .eq('id', auditId);

  } catch (error) {
    console.error('Error checking initial position:', error);
    await supabaseClient
      .from('vehicle_activation_audit')
      .update({
        initial_position_fetched: false,
        initial_position_response: { error: error.message },
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', auditId);
  }
}

async function handleEngineControl(supabaseClient: any, partnerId: string, body: VehicleManagementRequest) {
  const { vehicle_id, command, device_id } = body;

  if (!vehicle_id || !command || !device_id) {
    throw new Error('Missing required fields for engine control');
  }

  if (!['shutdown', 'enable'].includes(command)) {
    throw new Error('Invalid command. Must be "shutdown" or "enable"');
  }

  console.log('Engine control command:', { vehicle_id, command, device_id });

  // Create command audit record
  const { data: auditRecord, error: auditError } = await supabaseClient
    .from('command_audit')
    .insert({
      vehicle_id,
      technical_partner_id: partnerId,
      device_id,
      command_type: command === 'shutdown' ? 'engine_shutdown' : 'engine_enable',
      command_data: { command, device_id },
      status: 'pending'
    })
    .select()
    .single();

  if (auditError) {
    console.error('Failed to create command audit:', auditError);
  }

  // Send engine control command via GPS51
  let commandSuccess = false;
  let commandResponse = {};
  try {
    const gps51Command = command === 'shutdown' ? 'ENGINE_CUT' : 'ENGINE_RESTORE';
    
    const { data: commandResult, error: commandError } = await supabaseClient.functions.invoke('gps51-proxy', {
      body: {
        action: 'setcommand',
        params: {
          deviceid: device_id,
          cmd: gps51Command,
          param: '1'
        },
        method: 'POST'
      }
    });

    if (commandError) {
      commandResponse = { error: commandError.message };
    } else if (commandResult?.status === 0) {
      commandSuccess = true;
      commandResponse = commandResult;
      console.log('Engine control command sent successfully');
    } else {
      commandResponse = { error: commandResult?.message || 'Command failed' };
    }
  } catch (error) {
    commandResponse = { error: error.message };
    console.error('Engine control command exception:', error);
  }

  // Update audit record
  if (auditRecord) {
    await supabaseClient
      .from('command_audit')
      .update({
        response_data: commandResponse,
        status: commandSuccess ? 'success' : 'failed',
        error_message: commandSuccess ? null : JSON.stringify(commandResponse),
        completed_at: new Date().toISOString()
      })
      .eq('id', auditRecord.id);
  }

  return new Response(JSON.stringify({
    success: commandSuccess,
    message: commandSuccess ? `Engine ${command} command sent successfully` : 'Engine control command failed',
    command_result: commandResponse
  }), {
    status: commandSuccess ? 200 : 400,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleGetAudit(supabaseClient: any, partnerId: string, body: VehicleManagementRequest) {
  const { vehicle_id } = body;

  if (!vehicle_id) {
    throw new Error('Vehicle ID required');
  }

  const { data: auditRecords, error } = await supabaseClient
    .from('command_audit')
    .select('*')
    .eq('technical_partner_id', partnerId)
    .eq('vehicle_id', vehicle_id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch audit records: ${error.message}`);
  }

  return new Response(JSON.stringify({
    success: true,
    audit_records: auditRecords || []
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleGetConnectionStatus(supabaseClient: any, partnerId: string) {
  // Get all vehicles for this partner's users
  const { data: partnerUsers, error: usersError } = await supabaseClient
    .from('partner_users')
    .select(`
      user_id,
      vehicles:vehicles!vehicles_subscriber_id_fkey (
        id,
        gps51_device_id,
        plate
      )
    `)
    .eq('technical_partner_id', partnerId);

  if (usersError) {
    throw new Error(`Failed to fetch partner vehicles: ${usersError.message}`);
  }

  const vehicleStatuses = [];
  
  for (const user of partnerUsers || []) {
    for (const vehicle of user.vehicles || []) {
      if (vehicle.gps51_device_id) {
        let connectionStatus = 'Unknown';
        try {
          const { data: positionResult } = await supabaseClient.functions.invoke('gps51-proxy', {
            body: {
              action: 'lastposition',
              params: { deviceid: vehicle.gps51_device_id },
              method: 'POST'
            }
          });

          if (positionResult?.status === 0 && positionResult?.data?.updatetime) {
            const updateTime = new Date(positionResult.data.updatetime);
            const now = new Date();
            const minutesAgo = (now.getTime() - updateTime.getTime()) / (1000 * 60);
            
            connectionStatus = minutesAgo <= 5 ? 'Online' : 'Offline';
          } else {
            connectionStatus = 'Offline';
          }
        } catch (error) {
          console.error('Error checking connection for vehicle:', vehicle.id, error);
          connectionStatus = 'Error';
        }

        vehicleStatuses.push({
          vehicle_id: vehicle.id,
          plate_number: vehicle.plate,
          device_id: vehicle.gps51_device_id,
          connection_status: connectionStatus
        });
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    vehicle_statuses: vehicleStatuses
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

const handler = withSecurity(secureHandler, {
  rateLimit: PRODUCTION_SECURITY_CONFIG.rateLimits.default,
  requireSignature: false
});

serve(handler);