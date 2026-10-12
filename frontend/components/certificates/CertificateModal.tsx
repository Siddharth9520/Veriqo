'use client';

import React, { useState, useEffect } from 'react';
import { Project } from '@/lib/types';
import { apiClient, CertificateVerifyResult } from '@/lib/api-client';
import { BackendCertificate } from '@/lib/backend-bridge';
import { Icon } from '@/components/ui/Icons';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  defaultProjectId?: string;
}

export default function CertificateModal({
  isOpen,
  onClose,
  projects,
  defaultProjectId,
}: CertificateModalProps) {
  const [selectedAppId, setSelectedAppId] = useState<string>(
    defaultProjectId || (projects[0]?.id ? String(projects[0].id) : '1')
  );
  const [certificates, setCertificates] = useState<BackendCertificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, CertificateVerifyResult>>({});
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const numericId = parseInt(selectedAppId, 10);
    apiClient
      .getCertificates(!isNaN(numericId) ? numericId : undefined)
      .then((data) => {
        if (!cancelled) setCertificates(data);
      })
      .catch(() => {
        if (!cancelled) setCertificates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedAppId]);

  const refreshCertificates = async (appId: string) => {
    setLoading(true);
    try {
      const numericId = parseInt(appId, 10);
      const data = await apiClient.getCertificates(!isNaN(numericId) ? numericId : undefined);
      setCertificates(data);
    } catch {
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const numericId = parseInt(selectedAppId, 10);
    if (isNaN(numericId)) {
      showToast('Please select a valid registered application.');
      return;
    }

    setGenerating(true);
    showToast('Evaluating terminal test runs & computing deterministic QA score...');
    try {
      const cert = await apiClient.generateCertificate(numericId);
      showToast(`Issued QA Certificate ${cert.certificate_id} (Score: ${cert.score}/100, Grade: ${cert.grade})!`);
      await refreshCertificates(selectedAppId);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Certificate generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async (cert: BackendCertificate) => {
    setVerifyingId(cert.certificate_id);
    try {
      const res = await apiClient.verifyCertificate({
        certificate_id: cert.certificate_id,
        mode: 'database_backed',
      });
      setVerificationResults((prev) => ({ ...prev, [cert.certificate_id]: res }));
      if (res.verified) {
        showToast(`Certificate verified: SHA-256 hash matched and record confirmed!`);
      } else {
        showToast(`Verification issue: ${res.message}`);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Verification request failed.');
    } finally {
      setVerifyingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191B19]/75 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border-2 border-[#1A1C1A] brutal-shadow-lg max-w-4xl w-full p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#1A1C1A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#285C45] text-white border border-[#1A1C1A] flex items-center justify-center">
              <Icon name="verified" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-[20px] uppercase text-[#1A1C1A]">
                QA Certificates &amp; Integrity Verification
              </h3>
              <span className="font-mono text-[11px] text-[#404943]">
                Deterministic mathematical scoring with tamper-hashed SHA-256 evidence validation
              </span>
            </div>
          </div>
          <button onClick={onClose} className="hover:opacity-75">
            <Icon name="close" className="w-5 h-5 text-[#1A1C1A]" />
          </button>
        </div>

        {/* Project Selector and Action Bar */}
        <div className="bg-[#F4F4F0] border-2 border-[#1A1C1A] p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-bold text-[#1A1C1A] uppercase">
              Target App:
            </span>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="bg-[#FFFFFF] border border-[#1A1C1A] px-2 py-1 font-mono text-[12px] font-bold text-[#1A1C1A] focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.domain})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#285C45] text-white border-2 border-[#1A1C1A] px-4 py-1.5 font-headline text-[12px] uppercase font-bold hover:bg-[#0B442F] brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5"
          >
            <Icon name="star" className="w-4 h-4 text-white" />
            <span>{generating ? 'Evaluating Runs...' : 'Generate New Certificate'}</span>
          </button>
        </div>

        {/* Certificates List */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-3 border-[#285C45] border-t-transparent rounded-full animate-spin"></div>
              <span className="font-mono text-[12px] uppercase font-bold">Querying Certificates...</span>
            </div>
          ) : certificates.length === 0 ? (
            <div className="bg-[#FAF9F6] border border-[#1A1C1A] p-8 text-center flex flex-col items-center gap-2">
              <Icon name="verified" className="w-8 h-8 text-[#717973]" />
              <span className="font-headline font-bold text-[16px]">No Certificates Issued Yet</span>
              <p className="font-mono text-[12px] text-[#717973] max-w-md">
                Click &quot;Generate New Certificate&quot; to evaluate all completed test runs for this application and issue a tamper-hashed audit.
              </p>
            </div>
          ) : (
            certificates.map((cert) => {
              const verifyRes = verificationResults[cert.certificate_id];
              const scoreSummary = (cert.certificate_data?.score_summary as Record<string, unknown>) || {};
              const evidenceAudit = (cert.certificate_data?.evidence_audit as Record<string, unknown>) || {};
              const penalties = (scoreSummary.penalties as Record<string, unknown>) || {};

              const gradeColor: Record<string, string> = {
                A: 'bg-[#B7EFD0] text-[#002114]',
                B: 'bg-[#C9E7D5] text-[#002114]',
                C: 'bg-[#FFDF9B] text-[#4C3800]',
                D: 'bg-[#FFDAD5] text-[#93000A]',
                F: 'bg-[#AC3326] text-white',
              };

              return (
                <div
                  key={cert.id}
                  className="bg-[#FFFFFF] border-2 border-[#1A1C1A] p-4 brutal-shadow flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E2E3DF]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[14px] text-[#1A1C1A]">
                        {cert.certificate_id}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-bold px-2 py-0.5 border border-[#1A1C1A] uppercase ${
                          gradeColor[cert.grade] || 'bg-[#FAF9F6]'
                        }`}
                      >
                        Grade: {cert.grade} ({cert.score}/100)
                      </span>
                      <span className="bg-[#E8E8E5] text-[#1A1C1A] px-1.5 py-0.5 border border-[#1A1C1A] font-mono text-[10px] font-bold uppercase">
                        {cert.status}
                      </span>
                    </div>

                    <button
                      onClick={() => handleVerify(cert)}
                      disabled={verifyingId === cert.certificate_id}
                      className="bg-[#FFFFFF] text-[#1A1C1A] border border-[#1A1C1A] px-3 py-1 font-headline text-[11px] uppercase font-bold hover:bg-[#EEEEEA] flex items-center gap-1 self-start sm:self-auto"
                    >
                      <Icon
                        name="security"
                        className={`w-3.5 h-3.5 text-[#285C45] ${
                          verifyingId === cert.certificate_id ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {verifyingId === cert.certificate_id ? 'Verifying...' : 'Verify Integrity'}
                      </span>
                    </button>
                  </div>

                  {/* Verification Status Banner */}
                  {verifyRes && (
                    <div
                      className={`p-2.5 border font-mono text-[11px] flex items-center justify-between gap-2 ${
                        verifyRes.verified
                          ? 'bg-[#B7EFD0]/40 border-[#285C45] text-[#002114]'
                          : 'bg-[#FFDAD5]/40 border-[#AC3326] text-[#93000A]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon
                          name={verifyRes.verified ? 'check_circle' : 'warning'}
                          className="w-4 h-4"
                        />
                        <span>
                          {verifyRes.verified
                            ? `INTEGRITY VERIFIED: SHA-256 matched, record confirmed in Veriqo DB.`
                            : `VERIFICATION FAILED: ${verifyRes.message}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#404943]">
                        {verifyRes.verification_timestamp}
                      </span>
                    </div>
                  )}

                  {/* Tamper Hash */}
                  <div className="bg-[#F4F4F0] p-2 font-mono text-[11px] border border-[#C0C9C1] flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-[#717973]">
                      Tamper Hash (SHA-256 Unkeyed Checksum):
                    </span>
                    <span className="font-bold text-[#1A1C1A] break-all select-all">
                      {cert.tamper_hash}
                    </span>
                  </div>

                  {/* Metrics and Penalties Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                    <div className="bg-[#FAF9F6] border border-[#1A1C1A] p-2">
                      <span className="text-[10px] uppercase text-[#717973] block">Base Score</span>
                      <strong className="text-[13px] text-[#1A1C1A]">
                        {String(scoreSummary.base_score || 50.0)} pts
                      </strong>
                    </div>
                    <div className="bg-[#FAF9F6] border border-[#1A1C1A] p-2">
                      <span className="text-[10px] uppercase text-[#717973] block">Verified Defect Deductions</span>
                      <strong className="text-[13px] text-[#AC3326]">
                        -{String(penalties.verified_defects_deduction || 0)} pts
                      </strong>
                    </div>
                    <div className="bg-[#FAF9F6] border border-[#1A1C1A] p-2">
                      <span className="text-[10px] uppercase text-[#717973] block">Evidence Artifacts Audit</span>
                      <strong className="text-[13px] text-[#0B442F]">
                        {String(evidenceAudit.verified_artifacts_count || 0)}/
                        {String(evidenceAudit.expected_artifacts_count || 0)} Verified
                      </strong>
                    </div>
                  </div>

                  {/* Timestamp & Legal Disclaimer */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#E2E3DF] font-mono text-[10px] text-[#717973]">
                    <span>Issued: {new Date(cert.created_at).toLocaleString()}</span>
                    <span>Self-contained verifiable proof</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-[#E2E3DF]">
          <button
            onClick={onClose}
            className="bg-[#1A1C1A] text-white px-5 py-2 font-headline text-[12px] uppercase font-bold hover:bg-[#333]"
          >
            Close Certificates Console
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#191B19] text-[#F1F1ED] border-2 border-[#1A1C1A] px-4 py-2.5 font-mono text-[12px] brutal-shadow-lg z-50 flex items-center gap-2 animate-in fade-in duration-100">
          <Icon name="verified" className="w-4 h-4 text-[#B7EFD0]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
