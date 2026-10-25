# Here! · migrations (dbmate) : appliquées au démarrage, avant l'application web.
FROM ghcr.io/amacneil/dbmate:2.37.0
COPY migrations /db/migrations
ENV DBMATE_MIGRATIONS_DIR=/db/migrations \
    DBMATE_NO_DUMP_SCHEMA=true \
    DBMATE_WAIT=true
CMD ["up"]
