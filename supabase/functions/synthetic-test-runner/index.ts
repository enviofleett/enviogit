import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TestStep {
  step: string;
  action: string;
  data?: any;
  expected?: any;
}

interface TestScenario {
  id: string;
  name: string;
  scenario_type: string;
  test_steps: TestStep[];
  expected_outcomes: any;
  timeout_seconds: number;
  retry_count: number;
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { run_type = 'manual', scenarios = 'all', environment = 'test' } = await req.json();
    
    console.log('Synthetic Test Runner: Starting test execution', {
      run_type,
      scenarios,
      environment,
      timestamp: new Date().toISOString()
    });

    // Create test run record
    const { data: testRun, error: runError } = await supabase
      .from('synthetic_test_runs')
      .insert({
        run_type,
        environment,
        status: 'running',
        configuration: { scenarios, environment }
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create test run: ${runError.message}`);
    }

    console.log('Test Run Created:', testRun.id);

    // Get active test scenarios
    let query = supabase
      .from('synthetic_test_scenarios')
      .select('*')
      .eq('is_active', true)
      .eq('environment', environment);

    if (scenarios !== 'all') {
      query = query.in('scenario_type', Array.isArray(scenarios) ? scenarios : [scenarios]);
    }

    const { data: testScenarios, error: scenariosError } = await query;

    if (scenariosError) {
      throw new Error(`Failed to fetch test scenarios: ${scenariosError.message}`);
    }

    if (!testScenarios || testScenarios.length === 0) {
      // Update test run as completed with no scenarios
      await supabase
        .from('synthetic_test_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_scenarios: 0,
          execution_time_ms: Date.now() - startTime,
          error_summary: 'No active test scenarios found'
        })
        .eq('id', testRun.id);

      return new Response(
        JSON.stringify({
          success: false,
          testRunId: testRun.id,
          message: 'No active test scenarios found',
          totalScenarios: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${testScenarios.length} test scenarios to execute`);

    // Execute test scenarios
    const results = await executeTestScenarios(testRun.id, testScenarios);
    
    // Calculate final statistics
    const totalScenarios = results.length;
    const passedScenarios = results.filter(r => r.status === 'passed').length;
    const failedScenarios = results.filter(r => r.status === 'failed').length;
    const skippedScenarios = results.filter(r => r.status === 'skipped').length;
    
    const finalStatus = failedScenarios > 0 ? 'failed' : 'completed';
    const executionTime = Date.now() - startTime;

    // Update test run with final results
    const { error: updateError } = await supabase
      .from('synthetic_test_runs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        total_scenarios: totalScenarios,
        passed_scenarios: passedScenarios,
        failed_scenarios: failedScenarios,
        skipped_scenarios: skippedScenarios,
        execution_time_ms: executionTime
      })
      .eq('id', testRun.id);

    if (updateError) {
      console.error('Failed to update test run:', updateError);
    }

    // Create alerts for critical failures
    if (failedScenarios > 0) {
      await createFailureAlert(testRun.id, failedScenarios, totalScenarios, results);
    }

    console.log('Test execution completed:', {
      testRunId: testRun.id,
      totalScenarios,
      passedScenarios,
      failedScenarios,
      executionTime
    });

    return new Response(
      JSON.stringify({
        success: true,
        testRunId: testRun.id,
        results: {
          totalScenarios,
          passedScenarios,
          failedScenarios,
          skippedScenarios,
          executionTime,
          finalStatus
        },
        scenarios: results.map(r => ({
          scenarioId: r.scenario_id,
          status: r.status,
          executionTime: r.execution_time_ms,
          errorMessage: r.error_message
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Synthetic Test Runner error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeTestScenarios(testRunId: string, scenarios: TestScenario[]) {
  const results = [];

  for (const scenario of scenarios) {
    const scenarioStartTime = Date.now();
    
    console.log(`Executing scenario: ${scenario.name} (${scenario.scenario_type})`);
    
    try {
      const result = await executeScenario(testRunId, scenario);
      results.push(result);
    } catch (error) {
      console.error(`Scenario ${scenario.name} failed:`, error);
      
      // Create failed result record
      const failedResult = {
        test_run_id: testRunId,
        scenario_id: scenario.id,
        status: 'failed',
        started_at: new Date(scenarioStartTime).toISOString(),
        completed_at: new Date().toISOString(),
        execution_time_ms: Date.now() - scenarioStartTime,
        error_message: error.message,
        steps_executed: 0,
        steps_passed: 0,
        steps_failed: 1
      };

      await supabase.from('synthetic_test_results').insert(failedResult);
      results.push(failedResult);
    }
  }

  return results;
}

async function executeScenario(testRunId: string, scenario: TestScenario) {
  const scenarioStartTime = Date.now();
  const steps = scenario.test_steps || [];
  
  let stepsExecuted = 0;
  let stepsPassed = 0;
  let stepsFailed = 0;
  const stepResults = [];
  
  // Create initial test result record
  const { data: testResult, error: resultError } = await supabase
    .from('synthetic_test_results')
    .insert({
      test_run_id: testRunId,
      scenario_id: scenario.id,
      status: 'running',
      started_at: new Date(scenarioStartTime).toISOString()
    })
    .select()
    .single();

  if (resultError) {
    throw new Error(`Failed to create test result: ${resultError.message}`);
  }

  // Execute each test step
  for (const step of steps) {
    stepsExecuted++;
    const stepStartTime = Date.now();
    
    try {
      console.log(`Executing step: ${step.step} - ${step.action}`);
      
      const stepResult = await executeTestStep(step, scenario);
      stepResult.executionTime = Date.now() - stepStartTime;
      
      if (stepResult.success) {
        stepsPassed++;
      } else {
        stepsFailed++;
      }
      
      stepResults.push(stepResult);
      
    } catch (stepError) {
      console.error(`Step ${step.step} failed:`, stepError);
      stepsFailed++;
      
      stepResults.push({
        step: step.step,
        action: step.action,
        success: false,
        error: stepError.message,
        executionTime: Date.now() - stepStartTime
      });
    }
  }

  // Determine final scenario status
  const scenarioStatus = stepsFailed > 0 ? 'failed' : 'passed';
  const executionTime = Date.now() - scenarioStartTime;

  // Update test result with final status
  const updatedResult = {
    status: scenarioStatus,
    completed_at: new Date().toISOString(),
    execution_time_ms: executionTime,
    steps_executed: stepsExecuted,
    steps_passed: stepsPassed,
    steps_failed: stepsFailed,
    step_results: stepResults
  };

  await supabase
    .from('synthetic_test_results')
    .update(updatedResult)
    .eq('id', testResult.id);

  return {
    ...updatedResult,
    test_run_id: testRunId,
    scenario_id: scenario.id
  };
}

async function executeTestStep(step: TestStep, scenario: TestScenario): Promise<any> {
  const { action, data = {} } = step;
  
  switch (action) {
    case 'POST /api/register':
      return await simulateUserRegistration(data);
    
    case 'POST /api/verify-otp':
      return await simulateOTPVerification(data);
    
    case 'POST /api/login':
      return await simulateUserLogin(data);
    
    case 'POST /api/merchant/register':
      return await simulateMerchantRegistration(data);
    
    case 'PUT /api/admin/approve-merchant':
      return await simulateMerchantApproval(data);
    
    case 'POST /api/vehicles':
      return await simulateVehicleAddition(data);
    
    case 'GPS51 setcommand':
      return await simulateGPS51Command(data);
    
    case 'GPS51 lastposition':
      return await simulateGPS51PositionFetch(data);
    
    case 'GET /api/marketplace/offerings':
      return await simulateMarketplaceBrowse(data);
    
    case 'POST /api/marketplace/orders':
      return await simulateOrderCreation(data);
    
    case 'Paystack sandbox payment':
      return await simulatePaystackPayment(data);
    
    default:
      throw new Error(`Unknown test action: ${action}`);
  }
}

// Simplified simulation functions (in production, these would make real API calls)
async function simulateUserRegistration(data: any) {
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate API delay
  return { success: true, message: 'User registration simulated', data: { userId: 'test-user-123' } };
}

async function simulateOTPVerification(data: any) {
  await new Promise(resolve => setTimeout(resolve, 150));
  return { success: true, message: 'OTP verification simulated' };
}

async function simulateUserLogin(data: any) {
  await new Promise(resolve => setTimeout(resolve, 100));
  return { success: true, message: 'User login simulated', data: { token: 'test-token-123' } };
}

async function simulateMerchantRegistration(data: any) {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: true, message: 'Merchant registration simulated', data: { merchantId: 'test-merchant-123' } };
}

async function simulateMerchantApproval(data: any) {
  await new Promise(resolve => setTimeout(resolve, 100));
  return { success: true, message: 'Merchant approval simulated' };
}

async function simulateVehicleAddition(data: any) {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { success: true, message: 'Vehicle addition simulated', data: { vehicleId: 'test-vehicle-123' } };
}

async function simulateGPS51Command(data: any) {
  await new Promise(resolve => setTimeout(resolve, 500));
  // Simulate occasional GPS51 issues
  if (Math.random() < 0.1) { // 10% chance of 8902 error
    throw new Error('GPS51 Rate limit error (8902) - simulated');
  }
  return { success: true, message: 'GPS51 command simulated' };
}

async function simulateGPS51PositionFetch(data: any) {
  await new Promise(resolve => setTimeout(resolve, 800));
  // Simulate occasional GPS51 rate limiting
  if (Math.random() < 0.05) { // 5% chance of rate limit
    throw new Error('GPS51 Position fetch rate limited - simulated');
  }
  return { 
    success: true, 
    message: 'GPS51 position fetch simulated', 
    data: { 
      latitude: 6.5244 + (Math.random() - 0.5) * 0.1,
      longitude: 3.3792 + (Math.random() - 0.5) * 0.1,
      timestamp: Date.now()
    } 
  };
}

async function simulateMarketplaceBrowse(data: any) {
  await new Promise(resolve => setTimeout(resolve, 200));
  return { success: true, message: 'Marketplace browse simulated', data: { offeringsCount: 25 } };
}

async function simulateOrderCreation(data: any) {
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: true, message: 'Order creation simulated', data: { orderId: 'test-order-123' } };
}

async function simulatePaystackPayment(data: any) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Simulate occasional payment failures
  if (Math.random() < 0.02) { // 2% chance of payment failure
    throw new Error('Paystack payment failed - simulated');
  }
  return { success: true, message: 'Paystack payment simulated', data: { transactionId: 'test-txn-123' } };
}

async function createFailureAlert(testRunId: string, failedScenarios: number, totalScenarios: number, results: any[]) {
  const failureRate = (failedScenarios / totalScenarios) * 100;
  const criticalFailures = results.filter(r => 
    r.status === 'failed' && (
      r.error_message?.includes('8902') || 
      r.error_message?.includes('rate limit') ||
      r.error_message?.includes('GPS51')
    )
  );

  let alertType = 'test_failure';
  let severity = 'medium';

  if (criticalFailures.length > 0) {
    alertType = 'critical_path_failure';
    severity = 'high';
  } else if (failureRate > 50) {
    severity = 'high';
  }

  await supabase.from('synthetic_monitoring_alerts').insert({
    alert_type: alertType,
    severity,
    title: `Synthetic Test Run Failed`,
    description: `${failedScenarios} out of ${totalScenarios} test scenarios failed (${Math.round(failureRate)}% failure rate)`,
    test_run_id: testRunId,
    environment: 'test',
    metadata: {
      failedScenarios,
      totalScenarios,
      failureRate,
      criticalFailures: criticalFailures.length,
      gps51Issues: criticalFailures.filter(r => r.error_message?.includes('GPS51')).length
    }
  });
}