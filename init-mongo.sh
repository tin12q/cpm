#!/usr/bin/env bash
set -euo pipefail

DB_URI="mongodb://${MONGO_INITDB_ROOT_USERNAME:-root}:${MONGO_INITDB_ROOT_PASSWORD:-example}@localhost:27017/cpm?authSource=admin"
DATA_DIR="/docker-entrypoint-initdb.d/exampleDB"

import_file() {
  local file=$1
  local collection=$2
  if [ -f "${DATA_DIR}/${file}" ]; then
    echo "Importing ${collection} from ${file}"
    mongoimport --uri "${DB_URI}" --collection "${collection}" --file "${DATA_DIR}/${file}" --jsonArray
  else
    echo "File not found: ${DATA_DIR}/${file}" >&2
  fi
}

import_file "cpm.users.json" "users"
import_file "cpm.projects.json" "projects"
import_file "cpm.tasks.json" "tasks"
import_file "cpm.teams.json" "teams"
import_file "cpm.auths.json" "auths"

echo "Example data import completed."
