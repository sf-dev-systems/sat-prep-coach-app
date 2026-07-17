```

-- Taxonomy Schema Definition
-- Represents the hierarchical structure: Section -> Domain -> Skill

CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- e.g., 'Math', 'Reading/Writing', 'Strategy'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    weight NUMERIC(5, 2) NOT NULL DEFAULT 1.0, -- Used for the Mb calculation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for performance in recursive queries
CREATE INDEX idx_skills_domain_id ON skills(domain_id);
CREATE INDEX idx_domains_section_id ON domains(section_id);

-- Example Query to pull the full hierarchy
SELECT 
    s.name AS section,
    d.name AS domain,
    sk.name AS skill,
    sk.weight
FROM sections s
JOIN domains d ON s.id = d.section_id
JOIN skills sk ON d.id = sk.domain_id
ORDER BY s.name, d.name, sk.name;


```


This SQL defines the tables that are currently live in your Supabase project. 
I am maintaining this as the ground-truth reference for our build.