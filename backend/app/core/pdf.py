"""PDF generation from HTML content using WeasyPrint."""

from io import BytesIO

from weasyprint import HTML


def html_to_pdf(html_content: str) -> bytes:
    """Convert HTML string to PDF bytes."""
    doc = HTML(string=html_content)
    pdf_buffer = BytesIO()
    doc.write_pdf(pdf_buffer)
    return pdf_buffer.getvalue()
