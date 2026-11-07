// DATA ACCESS LAYER FOR THE FIELD-MAP SCREENS

import { cache } from "react";

import { adminFieldMapService } from "@server/listing/admin.field-map.service";

/**
 * What the admin's field-map screens read, on the server (listing-model/field-maps R6;
 * [ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 */
class FieldMapsDAL {
  getTypes = cache(async (channel: string) => adminFieldMapService.types(channel));
  getView = cache(async (channel: string, type: string) => adminFieldMapService.view(channel, type));
}

export const adminFieldMapsDAL = new FieldMapsDAL();
