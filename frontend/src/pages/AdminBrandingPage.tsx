/**
 * Admin Branding Page — Tenant Organization Profile + Branding Profile management.
 *
 * Phase 3C — Tenant Branding + Organization Profile Foundation.
 *
 * Features:
 * - Organization profile settings (name, address, contact, GST, etc.)
 * - Branding profile settings (colors, watermark, templates)
 * - Logo URL upload
 * - Footer customization (prescription, invoice)
 * - Document preview (invoice, prescription, encounter summary)
 *
 * Mobile-first responsive.
 *
 * TODO: Phase 4 — Logo file upload (multipart/form-data → object storage)
 * TODO: Phase 4 — Color picker with preset themes
 * TODO: Phase 4 — Custom document template upload
 * TODO: Phase 4 — Hospital chain / department branding overrides
 * TODO: Phase 4 — Multilingual branding support
 * TODO: Phase 4 — Dark mode theme support
 * TODO: Phase 4 — White-label domain configuration
 * TODO: Phase 4 — Custom typography settings
 * TODO: Phase 4 — QR verification configuration
 * TODO: Phase 4 — NABH/JCI accreditation metadata
 * TODO: Phase 4 — Patient portal theming
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Palette,
  Eye,
  Save,
  Loader2,
  Image,
  FileText,
  Receipt,
  Stethoscope,
  Globe,
  Phone,
  Mail,
  MapPin,
  Hash,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '../components/common';
import {
  getOrganizationProfile,
  updateOrganizationProfile,
  getBrandingProfile,
  updateBrandingProfile,
  previewDocument,
  type TenantOrganizationProfile,
  type TenantOrganizationProfileUpdate,
  type TenantBrandingProfile,
  type TenantBrandingProfileUpdate,
} from '../services/branding';

// ── Types ───────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

// ── Component ───────────────────────────────────────────────────────────────

export default function AdminBrandingPage() {
  const [activeTab, setActiveTab] = useState('organization');

  // Organization profile state
  const [orgProfile, setOrgProfile] = useState<TenantOrganizationProfile | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Branding profile state
  const [brandProfile, setBrandProfile] = useState<TenantBrandingProfile | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [brandError, setBrandError] = useState<string | null>(null);

  // Save status
  const [orgSaveStatus, setOrgSaveStatus] = useState<SaveStatus>('idle');
  const [brandSaveStatus, setBrandSaveStatus] = useState<SaveStatus>('idle');
  const [orgSaveError, setOrgSaveError] = useState<string | null>(null);
  const [brandSaveError, setBrandSaveError] = useState<string | null>(null);

  // Preview state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'invoice' | 'prescription' | 'encounter_summary'>('invoice');

  // ── Load profiles ─────────────────────────────────────────────────────────

  const loadProfiles = useCallback(async () => {
    setOrgLoading(true);
    setBrandLoading(true);
    setOrgError(null);
    setBrandError(null);

    try {
      const [org, brand] = await Promise.all([
        getOrganizationProfile(),
        getBrandingProfile(),
      ]);
      setOrgProfile(org);
      setBrandProfile(brand);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load branding profiles';
      setOrgError(msg);
      setBrandError(msg);
    } finally {
      setOrgLoading(false);
      setBrandLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // ── Save organization profile ─────────────────────────────────────────────

  const handleSaveOrg = async () => {
    if (!orgProfile) return;
    setOrgSaveStatus('saving');
    setOrgSaveError(null);

    try {
      const updateData: TenantOrganizationProfileUpdate = {
        organization_name: orgProfile.organization_name,
        legal_name: orgProfile.legal_name,
        logo_url: orgProfile.logo_url,
        phone: orgProfile.phone,
        email: orgProfile.email,
        website: orgProfile.website,
        address_line_1: orgProfile.address_line_1,
        address_line_2: orgProfile.address_line_2,
        city: orgProfile.city,
        state: orgProfile.state,
        postal_code: orgProfile.postal_code,
        country: orgProfile.country,
        gst_number: orgProfile.gst_number,
        registration_number: orgProfile.registration_number,
        timezone: orgProfile.timezone,
        currency: orgProfile.currency,
        prescription_footer: orgProfile.prescription_footer,
        invoice_footer: orgProfile.invoice_footer,
      };
      const updated = await updateOrganizationProfile(updateData);
      setOrgProfile(updated);
      setOrgSaveStatus('success');
      setTimeout(() => setOrgSaveStatus('idle'), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save organization profile';
      setOrgSaveError(msg);
      setOrgSaveStatus('error');
    }
  };

  // ── Save branding profile ─────────────────────────────────────────────────

  const handleSaveBrand = async () => {
    if (!brandProfile) return;
    setBrandSaveStatus('saving');
    setBrandSaveError(null);

    try {
      const updateData: TenantBrandingProfileUpdate = {
        primary_color: brandProfile.primary_color,
        secondary_color: brandProfile.secondary_color,
        accent_color: brandProfile.accent_color,
        document_header_style: brandProfile.document_header_style,
        watermark_text: brandProfile.watermark_text,
        prescription_template: brandProfile.prescription_template,
        invoice_template: brandProfile.invoice_template,
      };
      const updated = await updateBrandingProfile(updateData);
      setBrandProfile(updated);
      setBrandSaveStatus('success');
      setTimeout(() => setBrandSaveStatus('idle'), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save branding profile';
      setBrandSaveError(msg);
      setBrandSaveStatus('error');
    }
  };

  // ── Preview document ──────────────────────────────────────────────────────

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewHtml(null);

    try {
      const html = await previewDocument(previewType);
      setPreviewHtml(html);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to generate preview';
      setPreviewError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updateOrgField = (field: keyof TenantOrganizationProfileUpdate, value: string | null) => {
    setOrgProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateBrandField = (field: keyof TenantBrandingProfileUpdate, value: string | null) => {
    setBrandProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (orgLoading || brandLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Branding & Organization Profile</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orgError && brandError) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <ErrorState title="Failed to load branding profiles" description={orgError} onRetry={loadProfiles} />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Branding & Organization Profile</h1>
          <p className="text-sm text-muted-foreground">
            Configure your tenant identity, branding colors, and document appearance
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Organization</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
           TAB 1: ORGANIZATION PROFILE
           ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Details
              </CardTitle>
              <CardDescription>
                Legal business name, contact information, and compliance details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Organization Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org_name">Organization Name</Label>
                  <Input
                    id="org_name"
                    placeholder="e.g. Apollo Hospital"
                    value={orgProfile?.organization_name ?? ''}
                    onChange={(e) => updateOrgField('organization_name', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Legal Name</Label>
                  <Input
                    id="legal_name"
                    placeholder="e.g. Apollo Hospitals Enterprise Ltd."
                    value={orgProfile?.legal_name ?? ''}
                    onChange={(e) => updateOrgField('legal_name', e.target.value || null)}
                  />
                </div>
              </div>

              {/* Logo URL */}
              <div className="space-y-2">
                <Label htmlFor="logo_url" className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Logo URL
                </Label>
                <Input
                  id="logo_url"
                  placeholder="https://example.com/logo.png"
                  value={orgProfile?.logo_url ?? ''}
                  onChange={(e) => updateOrgField('logo_url', e.target.value || null)}
                />
                {orgProfile?.logo_url && (
                  <div className="mt-2 p-2 border rounded-md inline-block">
                    <img
                      src={orgProfile.logo_url}
                      alt="Logo preview"
                      className="max-h-16 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter a publicly accessible URL for your logo. File upload coming soon.
                  {/* TODO: Phase 4 — Logo file upload (multipart/form-data → object storage) */}
                </p>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+91-1234567890"
                    value={orgProfile?.phone ?? ''}
                    onChange={(e) => updateOrgField('phone', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@clinic.com"
                    value={orgProfile?.email ?? ''}
                    onChange={(e) => updateOrgField('email', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </Label>
                  <Input
                    id="website"
                    placeholder="https://clinic.com"
                    value={orgProfile?.website ?? ''}
                    onChange={(e) => updateOrgField('website', e.target.value || null)}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Address Line 1"
                    value={orgProfile?.address_line_1 ?? ''}
                    onChange={(e) => updateOrgField('address_line_1', e.target.value || null)}
                  />
                  <Input
                    placeholder="Address Line 2"
                    value={orgProfile?.address_line_2 ?? ''}
                    onChange={(e) => updateOrgField('address_line_2', e.target.value || null)}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Input
                    placeholder="City"
                    value={orgProfile?.city ?? ''}
                    onChange={(e) => updateOrgField('city', e.target.value || null)}
                  />
                  <Input
                    placeholder="State"
                    value={orgProfile?.state ?? ''}
                    onChange={(e) => updateOrgField('state', e.target.value || null)}
                  />
                  <Input
                    placeholder="Postal Code"
                    value={orgProfile?.postal_code ?? ''}
                    onChange={(e) => updateOrgField('postal_code', e.target.value || null)}
                  />
                  <Input
                    placeholder="Country"
                    value={orgProfile?.country ?? ''}
                    onChange={(e) => updateOrgField('country', e.target.value || null)}
                  />
                </div>
              </div>

              {/* Compliance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    GST Number
                  </Label>
                  <Input
                    id="gst"
                    placeholder="e.g. 27AAAPL1234C1Z1"
                    value={orgProfile?.gst_number ?? ''}
                    onChange={(e) => updateOrgField('gst_number', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg_no" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Registration / License Number
                  </Label>
                  <Input
                    id="reg_no"
                    placeholder="e.g. MCI-12345"
                    value={orgProfile?.registration_number ?? ''}
                    onChange={(e) => updateOrgField('registration_number', e.target.value || null)}
                  />
                </div>
              </div>

              {/* Regional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timezone
                  </Label>
                  <Input
                    id="timezone"
                    placeholder="Asia/Kolkata"
                    value={orgProfile?.timezone ?? ''}
                    onChange={(e) => updateOrgField('timezone', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Currency
                  </Label>
                  <Input
                    id="currency"
                    placeholder="INR"
                    value={orgProfile?.currency ?? ''}
                    onChange={(e) => updateOrgField('currency', e.target.value || null)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer Customization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Footer Customization
              </CardTitle>
              <CardDescription>
                Custom footers for prescriptions and invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prescription_footer">Prescription Footer</Label>
                <Textarea
                  id="prescription_footer"
                  placeholder="e.g. This prescription is valid for 3 days from the date of issue."
                  value={orgProfile?.prescription_footer ?? ''}
                  onChange={(e) => updateOrgField('prescription_footer', e.target.value || null)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_footer">Invoice Footer</Label>
                <Textarea
                  id="invoice_footer"
                  placeholder="e.g. Thank you for your visit. Payment is due within 15 days."
                  value={orgProfile?.invoice_footer ?? ''}
                  onChange={(e) => updateOrgField('invoice_footer', e.target.value || null)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3">
            {orgSaveStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {orgSaveError}
              </div>
            )}
            {orgSaveStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved successfully
              </div>
            )}
            <Button onClick={handleSaveOrg} disabled={orgSaveStatus === 'saving'}>
              {orgSaveStatus === 'saving' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Organization Profile
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
           TAB 2: BRANDING PROFILE
           ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding Colors
              </CardTitle>
              <CardDescription>
                Customize document colors and appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      placeholder="#2563eb"
                      value={brandProfile?.primary_color ?? ''}
                      onChange={(e) => updateBrandField('primary_color', e.target.value || null)}
                      className="font-mono"
                    />
                    <div
                      className="w-10 h-10 rounded-md border shrink-0"
                      style={{ backgroundColor: brandProfile?.primary_color || '#2563eb' }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary_color"
                      placeholder="#64748b"
                      value={brandProfile?.secondary_color ?? ''}
                      onChange={(e) => updateBrandField('secondary_color', e.target.value || null)}
                      className="font-mono"
                    />
                    <div
                      className="w-10 h-10 rounded-md border shrink-0"
                      style={{ backgroundColor: brandProfile?.secondary_color || '#64748b' }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accent_color">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent_color"
                      placeholder="#f59e0b"
                      value={brandProfile?.accent_color ?? ''}
                      onChange={(e) => updateBrandField('accent_color', e.target.value || null)}
                      className="font-mono"
                    />
                    <div
                      className="w-10 h-10 rounded-md border shrink-0"
                      style={{ backgroundColor: brandProfile?.accent_color || '#f59e0b' }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter hex color codes (e.g. #2563eb). These colors will be applied to document headers, footers, and accents.
                {/* TODO: Phase 4 — Color picker with preset themes */}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Styling
              </CardTitle>
              <CardDescription>
                Header style, watermark, and template selection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="header_style">Document Header Style</Label>
                <Input
                  id="header_style"
                  placeholder="default"
                  value={brandProfile?.document_header_style ?? ''}
                  onChange={(e) => updateBrandField('document_header_style', e.target.value || null)}
                />
                <p className="text-xs text-muted-foreground">
                  Options: default, minimal, branded
                  {/* TODO: Phase 4 — Custom header templates */}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="watermark">Watermark Text</Label>
                <Input
                  id="watermark"
                  placeholder="e.g. SAMPLE / DRAFT / CONFIDENTIAL"
                  value={brandProfile?.watermark_text ?? ''}
                  onChange={(e) => updateBrandField('watermark_text', e.target.value || null)}
                />
                <p className="text-xs text-muted-foreground">
                  Text displayed diagonally across documents (light opacity)
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prescription_template">Prescription Template</Label>
                  <Input
                    id="prescription_template"
                    placeholder="default"
                    value={brandProfile?.prescription_template ?? ''}
                    onChange={(e) => updateBrandField('prescription_template', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_template">Invoice Template</Label>
                  <Input
                    id="invoice_template"
                    placeholder="default"
                    value={brandProfile?.invoice_template ?? ''}
                    onChange={(e) => updateBrandField('invoice_template', e.target.value || null)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Template identifiers for document rendering. Leave as "default" for standard templates.
                {/* TODO: Phase 4 — Custom document template upload */}
                {/* TODO: Phase 4 — Multilingual template support */}
              </p>
            </CardContent>
          </Card>

          {/* Future TODO Hooks */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Future Branding Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">Multilingual Templates</Badge>
                <Badge variant="outline" className="text-xs">Dark Mode Themes</Badge>
                <Badge variant="outline" className="text-xs">White-Label Domains</Badge>
                <Badge variant="outline" className="text-xs">Custom Typography</Badge>
                <Badge variant="outline" className="text-xs">Hospital Chains</Badge>
                <Badge variant="outline" className="text-xs">QR Verification</Badge>
                <Badge variant="outline" className="text-xs">Doctor Signatures</Badge>
                <Badge variant="outline" className="text-xs">Digital Stamps</Badge>
                <Badge variant="outline" className="text-xs">NABH/JCI Metadata</Badge>
                <Badge variant="outline" className="text-xs">Patient Portal Theming</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3">
            {brandSaveStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {brandSaveError}
              </div>
            )}
            {brandSaveStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved successfully
              </div>
            )}
            <Button onClick={handleSaveBrand} disabled={brandSaveStatus === 'saving'}>
              {brandSaveStatus === 'saving' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Branding Profile
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
           TAB 3: DOCUMENT PREVIEW
           ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Document Preview
              </CardTitle>
              <CardDescription>
                Preview how your documents will look with current branding applied
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={previewType === 'invoice' ? 'default' : 'outline'}
                  onClick={() => setPreviewType('invoice')}
                  className="flex items-center gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  Invoice
                </Button>
                <Button
                  variant={previewType === 'prescription' ? 'default' : 'outline'}
                  onClick={() => setPreviewType('prescription')}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Prescription
                </Button>
                <Button
                  variant={previewType === 'encounter_summary' ? 'default' : 'outline'}
                  onClick={() => setPreviewType('encounter_summary')}
                  className="flex items-center gap-2"
                >
                  <Stethoscope className="h-4 w-4" />
                  Encounter Summary
                </Button>
              </div>

              <Button
                onClick={handlePreview}
                disabled={previewLoading}
                className="w-full sm:w-auto"
              >
                {previewLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Preview...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Generate Preview
                  </>
                )}
              </Button>

              {previewError && (
                <div className="flex items-center gap-2 text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  {previewError}
                </div>
              )}

              {previewHtml && (
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-3 py-2 text-xs text-muted-foreground border-b">
                    Document Preview — {previewType.replace('_', ' ').toUpperCase()}
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    title="Document Preview"
                    className="w-full h-[600px] bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
