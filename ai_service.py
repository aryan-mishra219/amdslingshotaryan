import os
import json
import google.generativeai as genai
from pydantic import BaseModel, ValidationError, Field
from typing import List
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

# Define the expected structure of the AI response using Pydantic
class MealOption(BaseModel):
    name: str = Field(description="The name of the suggested meal.")
    calories: int = Field(description="Estimated total calories.")
    protein_g: int = Field(description="Estimated protein in grams.")
    carbs_g: int = Field(description="Estimated carbohydrates in grams.")
    fats_g: int = Field(description="Estimated fats in grams.")
    reasoning: str = Field(description="Why this meal fits the user's request.")

class MealSuggestionResponse(BaseModel):
    suggestions: List[MealOption] = Field(description="List of suggested meals.")

# Ensure the API key is securely loaded from environment variables
api_key = os.environ.get("GOOGLE_API_KEY")
if not api_key:
    # In a real microservice, you might not want to crash on import if you load keys later,
    # but for strict security compliance, ensuring it's available early is a good practice.
    raise ValueError("GOOGLE_API_KEY environment variable is not set.")

# Configure the generative AI client
genai.configure(api_key=api_key)

def analyze_food(query: str) -> dict:
    """
    Analyzes a user's food-related query and suggests macro-friendly alternatives.

    This function utilizes the Google Gemini API to interpret the user's request
    and generates a structured JSON response containing tailored meal options
    that align with their dietary goals (e.g., high-protein, low-carb).

    Args:
        query (str): The user's contextual input describing their dietary 
                     preferences or current food choices.

    Returns:
        dict: A dictionary conforming to the MealSuggestionResponse Pydantic schema,
              containing a list of structured meal suggestions.

    Raises:
        ValueError: If the Google API fails to generate a valid response or invalid JSON.
        ValidationError: If the AI output does not match the expected Pydantic schema.
        RuntimeError: If any other unexpected error occurs during generation.
    """
    # Use the appropriate Gemini model for text generation
    # 'gemini-1.5-pro' or 'gemini-1.5-flash' are recommended for complex reasoning
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Construct a prompt that enforces the JSON structure based on our Pydantic schema
    prompt = f"""
    You are an expert sports nutritionist and dietician for the NutriSync app.
    A user has provided the following request regarding their meal: "{query}"
    
    Based on their request, suggest 3 highly optimal, macro-friendly meal alternatives.
    Provide your response strictly in the following JSON format without any markdown wrappers:
    {json.dumps(MealSuggestionResponse.model_json_schema())}
    
    Ensure your response is valid JSON and nothing else.
    """

    try:
        # Generate the response
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean up Markdown block formatting or extra text
        # Find the first '{' and the last '}' to extract only the JSON object
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}')
        
        if start_idx == -1 or end_idx == -1:
            raise ValueError(f"No valid JSON object found in AI response: {response_text}")
            
        response_text = response_text[start_idx:end_idx+1]

        # Parse the raw JSON
        raw_data = json.loads(response_text)
        
        # Validate the parsed data against our Pydantic schema
        validated_data = MealSuggestionResponse(**raw_data)
        
        # Return the validated data as a dictionary
        return validated_data.model_dump()
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse AI response as JSON: {e}")
    except ValidationError as e:
        raise ValidationError(f"AI response failed schema validation: {e}")
    except Exception as e:
        raise RuntimeError(f"An error occurred during food analysis: {e}")

import sys

if __name__ == "__main__":
    # If a query is passed as a command-line argument, process it and return raw JSON.
    if len(sys.argv) > 1:
        query = sys.argv[1]
        try:
            result = analyze_food(query)
            # Output only the JSON string for the Node.js bridge to capture
            print(json.dumps(result))
            sys.exit(0)
        except Exception as err:
            print(f"Error: {str(err)}", file=sys.stderr)
            sys.exit(1)
    else:
        # Example usage for manual testing
        test_query = "I want a high protein lunch for muscle growth"
        try:
            print(f"Analyzing test query: '{test_query}'...")
            result = analyze_food(test_query)
            print(json.dumps(result, indent=2))
        except Exception as err:
            print(f"Test Error: {err}")
