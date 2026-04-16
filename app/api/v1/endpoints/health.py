from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check() -> str:
    return "OK"
