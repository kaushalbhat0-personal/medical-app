itals_html}
{followup_html}
</div>

    return _build_html_document(body, branding=data.branding_context)


def _aggregate_prescription_data(
    aggregate: EncounterDetailAggregate,
    *,
    tenant_id: UUID | None = None,
) -> PrescriptionDocumentData:
    """Aggregate prescription data from encounter aggregate for PDF generation.

    CRITICAL: Only prescription model data is used — NOT inventory usage.
    """
    appt = aggregate.appointment
    patient = aggregate.patient
    doctor = aggregate.doctor

    # Resolve tenant_id defensively
    resolved_tenant_id = tenant_id or appt.tenant_id
    if not resolved_tenant_id:
        logger.warning("[DOC_TRACE] No tenant_id available for prescription data; using placeholder")
        resolved_tenant_id = UUID("00000000-0000-0000-0000-000000000000")

    logger.info(
        "[DOC_TRACE] _aggregate_prescription_data: appointment_id=%s patient_id=%s tenant_id=%s prescription_count=%d",
        appt.id,
        patient.id,
        resolved_tenant_id,
        len(aggregate.prescriptions),
    )

    # Build prescription items from the aggregate
    rx_items = []
    for rx in aggregate.prescriptions:
        rx_items.append({
            "medicine_name": rx.medicine_name,
            "dosage": rx.dosage,
            "frequency": rx.frequency,
            "duration": rx.duration,
            "instructions": rx.instructions,
            "route": rx.route,
        })

    return PrescriptionDocumentData(
        appointment_id=appt.id,
        doctor_id=doctor.id,
        doctor_name=doctor.name,
        doctor_specialization=doctor.specialization,
        patient_id=patient.id,
        patient_name=patient.name,
        tenant_id=resolved_tenant_id,
        diagnosis=appt.diagnosis,
        prescriptions=rx_items,
        vitals=aggregate.vitals.model_dump() if aggregate.vitals else None,
        notes=appt.clinical_notes,
        created_at=appt.updated_at or appt.created_at,
    )


def _aggregate_encounter_summary_data(
    aggregate: EncounterDetailAggregate,
    *,
    tenant_id: UUID | None = None,
) -> EncounterSummaryDocumentData:
    """Aggregate encounter summary data from encounter aggregate for PDF generation."""
    appt = aggregate.appointment
    patient = aggregate.patient
    doctor = aggregate.doctor

    # Resolve tenant_id defensively
    resolved_tenant_id = tenant_id or appt.tenant_id
    if not resolved_tenant_id:
        logger.warning("[DOC_TRACE] No tenant_id available for encounter summary; using placeholder")
        resolved_tenant_id = UUID("00000000-0000-0000-0000-000000000000")

    logger.info(
        "[DOC_TRACE] _aggregate_encounter_summary_data: appointment_id=%s patient_id=%s tenant_id=%s prescription_count=%d",
        appt.id,
        patient.id,
        resolved_tenant_id,
        len(aggregate.prescriptions),
    )

    # Build prescription items
    rx_items = []
    for rx in aggregate.prescriptions:
        rx_items.append({
            "medicine_name": rx.medicine_name,
            "dosage": rx.dosage,
            "frequency": rx.frequency,
            "duration": rx.duration,
            "instructions": rx.instructions,
        })

    return EncounterSummaryDocumentData(
        appointment_id=appt.id,
        patient_id=patient.id,
        patient_name=patient.name,
        doctor_id=doctor.id,
        doctor_name=doctor.name,
        doctor_specialization=doctor.specialization,
        tenant_id=resolved_tenant_id,
        appointment_time=appt.appointment_time,
        status=appt.status,
        encounter_started_at=appt.encounter_started_at,
        encounter_completed_at=appt.encounter_completed_at,
        subjective_notes=appt.subjective_notes,
        objective_notes=appt.objective_notes,
        assessment_notes=appt.assessment_notes,
        plan_notes=appt.plan_notes,
        diagnosis=appt.diagnosis,
        treatment_summary=appt.treatment_summary,
        clinical_notes=appt.clinical_notes,
        vitals=aggregate.vitals.model_dump() if aggregate.vitals else None,
        prescriptions=rx_items,
        follow_up_date=appt.follow_up_date,
        follow_up_notes=appt.follow_up_notes,
        created_at=appt.updated_at or appt.created_at,
    )


# ═════════════════════════════════════════════════════════════════════════════
# PDF GENERATORS
# ═════════════════════════════════════════════════════════════════════════════


def generate_invoice_pdf(
    db: Session,
    bill_id: UUID,
    current_user: User,
    tenant_id: UUID | None = None,
    fmt: DocumentFormat = DocumentFormat.pdf,
) -> bytes:
    """Generate invoice PDF for the given bill."""
    from app.services.reporting_service import get_billing_aggregate

    # Load billing aggregate
    aggregate = get_billing_aggregate(db, bill_id, current_user, tenant_id)

    # Build document data
    data = InvoiceDocumentData(
        bill_id=aggregate.bill_id,
        patient_id=aggregate.patient_id,
        patient_name=aggregate.patient_name,
        doctor_id=aggregate.doctor_id,
        doctor_name=aggregate.doctor_name,
        doctor_specialization=aggregate.doctor_specialization,
        appointment_id=aggregate.appointment_id,
        appointment_time=aggregate.appointment_time,
        tenant_id=aggregate.tenant_id,
        tenant_name=aggregate.tenant_name,
        bill_amount=aggregate.total_amount,
        consultation_amount=aggregate.consultation_amount,
        inventory_amount=aggregate.inventory_amount,
        inventory_items=aggregate.inventory_items,
        status=aggregate.status,
        paid_at=aggregate.paid_at,
        paid_via=aggregate.paid_via,
        created_at=aggregate.created_at,
    )

    html = _build_invoice_html(data)
    return _render_pdf(html, fmt)


def generate_patient_statement_pdf(
    db: Session,
    patient_id: UUID,
    current_user: User,
    tenant_id: UUID | None = None,
    fmt: DocumentFormat = DocumentFormat.pdf,
) -> bytes:
    """Generate patient financial statement PDF."""
    from app.services.reporting_service import get_patient_financial_ledger

    ledger = get_patient_financial_ledger(db, patient_id, current_user, tenant_id)

    data = PatientStatementDocumentData(
        patient_id=ledger.patient_id,
        patient_name=ledger.patient_name,
        tenant_id=ledger.tenant_id,
        tenant_name=ledger.tenant_name,
        total_billed=ledger.total_billed,
        total_paid=ledger.total_paid,
        total_unpaid=ledger.total_unpaid,
        balance=ledger.balance,
        last_payment_at=ledger.last_payment_at,
        bills=ledger.bills,
        encounters=ledger.encounters,
        statement_date_from=ledger.statement_date_from,
        statement_date_to=ledger.statement_date_to,
    )

    html = _build_patient_statement_html(data)
    return _render_pdf(html, fmt)


def generate_prescription_pdf(
    db: Session,
    appointment_id: UUID,
    current_user: User,
    tenant_id: UUID | None = None,
    fmt: DocumentFormat = DocumentFormat.pdf,
) -> bytes:
    """Generate prescription PDF for the given appointment.

    CRITICAL: Only prescription model data is used — NOT inventory usage.
    """
    from app.services.encounter_service import get_encounter_detail

    # Load encounter aggregate
    aggregate = get_encounter_detail(db, appointment_id, current_user, tenant_id)

    # Aggregate prescription data
    data = _aggregate_prescription_data(aggregate, tenant_id=tenant_id)

    html = _build_prescription_html(data)
    return _render_pdf(html, fmt)


def generate_encounter_summary_pdf(
    db: Session,
    appointment_id: UUID,
    current_user: User,
    tenant_id: UUID | None = None,
    fmt: DocumentFormat = DocumentFormat.pdf,
) -> bytes:
    """Generate encounter summary PDF for the given appointment."""
    from app.services.encounter_service import get_encounter_detail

    # Load encounter aggregate
    aggregate = get_encounter_detail(db, appointment_id, current_user, tenant_id)

    # Aggregate encounter summary data
    data = _aggregate_encounter_summary_data(aggregate, tenant_id=tenant_id)

    html = _build_encounter_summary_html(data)
    return _render_pdf(html, fmt)


# ═════════════════════════════════════════════════════════════════════════════
# PDF RENDERER
# ═════════════════════════════════════════════════════════════════════════════


def _render_pdf(html: str, fmt: DocumentFormat) -> bytes:
    """Render HTML to PDF (or return HTML bytes for preview)."""
    if fmt == DocumentFormat.html:
        return html.encode("utf-8")

    try:
        from weasyprint import HTML as WeasyprintHTML

        pdf_bytes = WeasyprintHTML(string=html).write_pdf()
        return pdf_bytes
    except ImportError:
        logger.warning("weasyprint not installed; falling back to HTML output")
        return html.encode("utf-8")
    except Exception:
        logger.exception("PDF generation failed; falling back to HTML output")
        return html.encode("utf-8")
