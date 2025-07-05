// Email Template Service - Template management and rendering for Envio Fleet Management
import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  template_type: string;
  gps51_data_fields: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RenderedEmail {
  subject: string;
  body: string;
}

export class EmailTemplateService {
  private templateCache = new Map<string, EmailTemplate>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  /**
   * Get email template by name
   */
  async getTemplate(templateName: string): Promise<EmailTemplate | null> {
    try {
      // Check cache first
      if (this.isCacheValid() && this.templateCache.has(templateName)) {
        return this.templateCache.get(templateName) || null;
      }

      // Fetch from database
      const { data: template, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('name', templateName)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      // Update cache
      const processedTemplate = {
        ...template,
        gps51_data_fields: template.gps51_data_fields as Record<string, any> || {}
      };
      this.templateCache.set(processedTemplate.name, processedTemplate);
      this.lastCacheUpdate = Date.now();

      return processedTemplate;

    } catch (error) {
      console.error('EmailTemplateService: Error getting template:', templateName, error);
      return null;
    }
  }

  /**
   * Get all active templates
   */
  async getAllTemplates(): Promise<EmailTemplate[]> {
    try {
      const { data: templates, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw error;
      }

      return (templates || []).map(template => ({
        ...template,
        gps51_data_fields: template.gps51_data_fields as Record<string, any> || {}
      }));

    } catch (error) {
      console.error('EmailTemplateService: Error getting all templates:', error);
      return [];
    }
  }

  /**
   * Render template with data
   */
  async renderTemplate(template: EmailTemplate, data: Record<string, any>): Promise<RenderedEmail> {
    try {
      const subject = this.interpolateTemplate(template.subject_template, data);
      const body = this.interpolateTemplate(template.body_template, data);

      return {
        subject,
        body
      };

    } catch (error) {
      console.error('EmailTemplateService: Error rendering template:', template.name, error);
      throw error;
    }
  }

  /**
   * Create new email template
   */
  async createTemplate(templateData: {
    name: string;
    subject_template: string;
    body_template: string;
    template_type: string;
    gps51_data_fields?: Record<string, any>;
  }): Promise<EmailTemplate> {
    try {
      const { data: template, error } = await supabase
        .from('email_templates')
        .insert({
          name: templateData.name,
          subject_template: templateData.subject_template,
          body_template: templateData.body_template,
          template_type: templateData.template_type,
          gps51_data_fields: templateData.gps51_data_fields || {},
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update cache
      const processedTemplate = {
        ...template,
        gps51_data_fields: template.gps51_data_fields as Record<string, any> || {}
      };
      this.templateCache.set(processedTemplate.name, processedTemplate);

      return processedTemplate;

    } catch (error) {
      console.error('EmailTemplateService: Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update email template
   */
  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    try {
      const { data: template, error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', templateId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update cache
      const processedTemplate = {
        ...template,
        gps51_data_fields: template.gps51_data_fields as Record<string, any> || {}
      };
      this.templateCache.set(processedTemplate.name, processedTemplate);

      return processedTemplate;

    } catch (error) {
      console.error('EmailTemplateService: Error updating template:', error);
      throw error;
    }
  }

  /**
   * Delete email template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      // Get template name first for cache removal
      const { data: template } = await supabase
        .from('email_templates')
        .select('name')
        .eq('id', templateId)
        .single();

      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        throw error;
      }

      // Remove from cache
      if (template?.name) {
        this.templateCache.delete(template.name);
      }

    } catch (error) {
      console.error('EmailTemplateService: Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(templateName: string, sampleData?: Record<string, any>): Promise<RenderedEmail> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Use sample data or default values based on template's GPS51 data fields
    const previewData = sampleData || this.generateSampleData(template.gps51_data_fields);

    return await this.renderTemplate(template, previewData);
  }

  /**
   * Interpolate template string with data
   */
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined || value === null) {
        console.warn(`EmailTemplateService: Missing template variable: ${key}`);
        return `[${key}]`; // Show missing variables clearly
      }
      return String(value);
    });
  }

  /**
   * Generate sample data for template preview
   */
  private generateSampleData(gps51DataFields: Record<string, any>): Record<string, any> {
    const sampleData: Record<string, any> = {};

    Object.keys(gps51DataFields).forEach(key => {
      const fieldType = gps51DataFields[key];
      
      switch (fieldType) {
        case 'string':
          sampleData[key] = `Sample ${key}`;
          break;
        case 'number':
          sampleData[key] = 42;
          break;
        case 'date':
          sampleData[key] = new Date().toLocaleDateString();
          break;
        default:
          sampleData[key] = `Sample ${key}`;
      }
    });

    // Add common default values
    if (!sampleData.user_name) sampleData.user_name = 'John Doe';
    if (!sampleData.vehicle_name) sampleData.vehicle_name = 'Fleet Vehicle 001';
    if (!sampleData.alert_time) sampleData.alert_time = new Date().toLocaleString();
    if (!sampleData.location) sampleData.location = '40.7128, -74.0060';

    return sampleData;
  }

  /**
   * Check if template cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Get template variables from template string
   */
  getTemplateVariables(templateString: string): string[] {
    const matches = templateString.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    
    return matches.map(match => match.replace(/[{}]/g, ''));
  }

  /**
   * Validate template syntax
   */
  validateTemplate(subjectTemplate: string, bodyTemplate: string): {
    isValid: boolean;
    errors: string[];
    variables: string[];
  } {
    const errors: string[] = [];
    const allVariables = new Set<string>();

    try {
      // Check for unclosed template variables
      const subjectVars = this.getTemplateVariables(subjectTemplate);
      const bodyVars = this.getTemplateVariables(bodyTemplate);

      subjectVars.forEach(v => allVariables.add(v));
      bodyVars.forEach(v => allVariables.add(v));

      // Check for basic HTML validity in body (simplified)
      if (bodyTemplate.includes('<') && bodyTemplate.includes('>')) {
        const openTags = (bodyTemplate.match(/<[^/][^>]*>/g) || []).length;
        const closeTags = (bodyTemplate.match(/<\/[^>]*>/g) || []).length;
        
        if (openTags !== closeTags) {
          errors.push('HTML tags appear to be unbalanced');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        variables: Array.from(allVariables)
      };

    } catch (error) {
      errors.push(`Template validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        isValid: false,
        errors,
        variables: Array.from(allVariables)
      };
    }
  }
}