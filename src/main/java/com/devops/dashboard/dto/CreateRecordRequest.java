package com.devops.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * DTO for creating a new demo record.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateRecordRequest {
    private String name;
    private String description;

    public CreateRecordRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
