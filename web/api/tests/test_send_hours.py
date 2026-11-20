from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app import messaging


@pytest.fixture
def hours(monkeypatch: pytest.MonkeyPatch):
    def set_hours(start: int, end: int) -> None:
        settings = SimpleNamespace(
            whatsapp_send_start_hour=start, whatsapp_send_end_hour=end
        )
        monkeypatch.setattr(messaging, "get_settings", lambda: settings)

    return set_hours


def at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, day, hour, minute, tzinfo=UTC)


def test_no_evening_sends_whatever_the_setting(hours) -> None:
    hours(8, 24)  # réglage d'environnement trop large
    assert messaging.send_hours() == (8, 20)
    assert messaging.in_send_hours(at(19, 19, 59))
    assert not messaging.in_send_hours(at(19, 20))
    assert not messaging.in_send_hours(at(19, 7, 59))


def test_next_send_at(hours) -> None:
    hours(8, 20)
    assert messaging.next_send_at(at(19, 10)) == at(19, 10)  # tout de suite
    assert messaging.next_send_at(at(19, 6)) == at(19, 8)  # ce matin
    assert messaging.next_send_at(at(19, 21, 30)) == at(20, 8)  # demain matin
