from uuid import uuid4
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, delete

from src.db.models import User, UserRole


class UserService:
    async def get_user_by_email(self, email: str, session: AsyncSession) -> User | None:
        statement = select(User).where(
            User.email == email
        )

        result = await session.exec(statement)
        return result.first() or None

    async def get_user_by_clerk_id(self, clerk_id: str, session: AsyncSession) -> User | None:
        statement = select(User).where(
            User.clerk_user_id == clerk_id
        ).limit(1)

        result = await session.exec(statement)
        return result.first()

    async def create_user(self, email: str, first_name: str | None, last_name: str | None, clerk_user_id: str | None, session: AsyncSession) -> User:
        new_user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            clerk_user_id=clerk_user_id
        )

        session.add(new_user)
        await session.commit()

        return new_user

    async def get_or_create_from_clerk(
        self,
        clerk_user_id: str,
        email: str,
        first_name: str | None,
        last_name: str | None,
        session: AsyncSession,
    ) -> User:
        existing = await self.get_user_by_clerk_id(clerk_user_id, session)
        if existing:
            return existing

        stmt = pg_insert(User).values(
            uid=uuid4(),
            email=email,
            first_name=first_name,
            last_name=last_name,
            clerk_user_id=clerk_user_id,
            role=UserRole.USER.value,
            create_at=datetime.utcnow(),
        ).on_conflict_do_nothing(constraint="uq_users_clerk_user_id")

        try:
            await session.execute(stmt)
            await session.commit()
        except IntegrityError:
            await session.rollback()

        user = await self.get_user_by_clerk_id(clerk_user_id, session)
        if user:
            return user

        user = await self.get_user_by_email(email, session)
        if user and user.clerk_user_id in (None, clerk_user_id):
            user.clerk_user_id = clerk_user_id
            session.add(user)
            await session.commit()
            return user

        raise RuntimeError("Failed to get or create user")

    async def upsert_from_clerk(
        self,
        clerk_user_id: str,
        email: str,
        first_name: str | None,
        last_name: str | None,
        session: AsyncSession,
    ) -> User:
        stmt = pg_insert(User).values(
            uid=uuid4(),
            email=email,
            first_name=first_name,
            last_name=last_name,
            clerk_user_id=clerk_user_id,
            role=UserRole.USER.value,
            create_at=datetime.utcnow(),
        ).on_conflict_do_update(
            constraint="uq_users_clerk_user_id",
            set_={
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
            },
        )

        try:
            await session.execute(stmt)
            await session.commit()
        except IntegrityError:
            await session.rollback()

        user = await self.get_user_by_clerk_id(clerk_user_id, session)
        if user:
            if user.email != email or user.first_name != first_name or user.last_name != last_name:
                user.email = email
                user.first_name = first_name
                user.last_name = last_name
                session.add(user)
                await session.commit()
            return user

        user = await self.get_user_by_email(email, session)
        if user:
            user.clerk_user_id = clerk_user_id
            user.first_name = first_name
            user.last_name = last_name
            session.add(user)
            await session.commit()
            return user

        raise RuntimeError("Failed to upsert user")

    async def delete_user(self, clerk_user_id: str, session: AsyncSession) -> None:
        if not clerk_user_id:
            return

        statement = delete(User).where(
            User.clerk_user_id == clerk_user_id)  # type:ignore

        await session.execute(statement)
        await session.commit()
