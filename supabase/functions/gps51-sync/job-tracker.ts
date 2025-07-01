
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export class GPS51JobTracker {
  private supabase: any;
  private jobId: string | null = null;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async startJob(priority: number, cronTriggered: boolean, batchMode: boolean): Promise<void> {
    if (cronTriggered || (batchMode && priority)) {
      const { data: jobData, error: jobError } = await this.supabase
        .from('gps51_sync_jobs')
        .insert({
          priority: priority || 0,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (!jobError && jobData) {
        this.jobId = jobData.id;
        console.log(`Job logged with ID: ${this.jobId}`);
      }
    }
  }

  async completeJob(
    success: boolean,
    vehiclesProcessed: number,
    positionsStored: number,
    executionTimeSeconds: number,
    errorMessage?: string
  ): Promise<void> {
    if (this.jobId) {
      await this.supabase
        .from('gps51_sync_jobs')
        .update({
          completed_at: new Date().toISOString(),
          success,
          vehicles_processed: vehiclesProcessed,
          positions_stored: positionsStored,
          error_message: errorMessage || null,
          execution_time_seconds: executionTimeSeconds
        })
        .eq('id', this.jobId);

      console.log(`Job ${this.jobId} completed: success=${success}, vehicles=${vehiclesProcessed}, positions=${positionsStored}`);
    }
  }

  async failJob(executionTimeSeconds: number, errorMessage: string): Promise<void> {
    if (this.jobId) {
      await this.supabase
        .from('gps51_sync_jobs')
        .update({
          completed_at: new Date().toISOString(),
          success: false,
          error_message: errorMessage,
          execution_time_seconds: executionTimeSeconds
        })
        .eq('id', this.jobId);
    }
  }
}
