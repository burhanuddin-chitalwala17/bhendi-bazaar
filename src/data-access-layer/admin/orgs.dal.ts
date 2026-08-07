// src/components/admin/orgsContainer/orgs.dal.ts

import { cache } from "react";
import type { OrgWithStats } from "@/domain/org";
import { orgRepository } from "@server/catalog/org.repository";

class OrgsDAL {
    getOrgs = cache(async (): Promise<OrgWithStats[]> => {
        const orgs = await orgRepository.findAll(true);
        return orgs;
    });
}

export const orgsDAL = new OrgsDAL();