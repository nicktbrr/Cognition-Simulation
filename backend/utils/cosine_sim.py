"""
This module provides functionality for computing semantic similarity between text sequences using BERT embeddings.
It includes utilities for text preprocessing, embedding generation, and similarity calculations.
"""

from transformers import BertTokenizer, BertModel
import torch
import re
import random
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from functools import lru_cache

# Initialize BERT tokenizer and model
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
model = BertModel.from_pretrained("bert-base-uncased")
model.eval()  # Set model to evaluation mode for consistent results

@lru_cache(maxsize=128)
def preprocess_text(text, random_mask_option=False, indexed_tokens=True):
    """
    Preprocess text for BERT model input.
    
    Args:
        text (str): Input text to preprocess
        random_mask_option (bool): If True, randomly masks a token for MLM training
        indexed_tokens (bool): If True, returns token indices; if False, returns tokenized text
        
    Returns:
        Union[List[int], List[str]]: Either token indices or tokenized text based on indexed_tokens parameter
    """
    # Normalize text to lowercase
    text = text.lower()
    # Remove special characters and extra spaces
    text = re.sub(r"[^a-zA-Z0-9\s]+|\s+", " ", text).strip()

    # Tokenize input text
    tokenized_text = tokenizer.tokenize(text)

    # Optional random masking for MLM training
    if random_mask_option and tokenized_text:
        mask_index = (
            random.randint(1, len(tokenized_text) - 2) if len(tokenized_text) > 2 else 0
        )
        tokenized_text[mask_index] = "[MASK]"

    # Convert tokens to indices if requested
    if indexed_tokens:
        indexed_tokens = tokenizer.convert_tokens_to_ids(tokenized_text)
        return indexed_tokens
    else:
        return tokenized_text


def get_bert_embeddings(indexed_tokens):
    """
    Generate BERT embeddings for a sequence of token indices.
    
    Args:
        indexed_tokens (List[int]): List of token indices from the BERT tokenizer
        
    Returns:
        torch.Tensor: BERT embeddings for the input sequence
    """
    # Prepare input tensors
    input_ids = torch.tensor([indexed_tokens])
    attention_mask = torch.tensor([[1] * len(indexed_tokens)])

    # Generate embeddings using BERT model
    with torch.no_grad():
        outputs = model(input_ids, attention_mask=attention_mask)
        last_hidden_states = outputs.last_hidden_state

    # Use [CLS] token embedding as sentence representation
    sentence_embedding = last_hidden_states[:, 0, :].squeeze()
    return sentence_embedding


def calculate_cosine_similarity(embedding1, embedding2):
    """
    Calculate cosine similarity between two embeddings.
    
    Args:
        embedding1 (numpy.ndarray): First embedding vector
        embedding2 (numpy.ndarray): Second embedding vector
        
    Returns:
        float: Cosine similarity score between the embeddings
    """
    embedding1 = embedding1.reshape(1, -1)  # Reshape to 2D array
    embedding2 = embedding2.reshape(1, -1)  # Reshape to 2D array
    similarity = cosine_similarity(embedding1, embedding2)
    return similarity[0][0]


def create_sim_matrix(df):
    """
    Create similarity matrices for a DataFrame of text sequences.
    
    This function computes two types of similarities:
    1. Mean similarity matrix: Average similarity between steps across all trials
    2. Stepwise similarity: Average similarity between trials for each step
    
    Args:
        df (pandas.DataFrame): DataFrame containing text sequences, where each row is a trial
                             and each column (except first) represents a step
    
    Returns:
        dict: Dictionary containing JSON-serialized similarity matrices
    """
    num_rows = len(df)
    num_steps = len(df.columns) - 1  # Exclude the first column
    embedding_dim = get_bert_embeddings(preprocess_text("sample")).shape[0]

    # Initialize array to store all embeddings
    all_embeddings = np.zeros((num_rows, num_steps, embedding_dim))

    # Generate embeddings for all text sequences
    for i in range(num_rows):
        for j in range(num_steps):
            text = preprocess_text(df.iloc[i, j + 1])  # Skip the first column
            all_embeddings[i, j] = get_bert_embeddings(text)

    # Initialize similarity tensor and stepwise similarity arrays
    similarity_tensor = np.ones((num_steps, num_steps, num_rows))
    stepwise_similarity = [0] * num_steps
    stepwise_similarity_sums = [0] * num_steps
    stepwise_similarity_counts = [0] * num_steps

    # Calculate both trial-wise and stepwise similarities
    for i in range(num_rows):
        embeddings = all_embeddings[i]  # Current trial embeddings

        # Calculate trial-wise similarities (within same trial)
        for j in range(num_steps):
            for k in range(j, num_steps):
                similarity = calculate_cosine_similarity(embeddings[j], embeddings[k])
                similarity_tensor[j, k, i] = similarity
                similarity_tensor[k, j, i] = similarity  # Symmetric matrix

            # Calculate stepwise similarities (across trials)
            step_embeddings = all_embeddings[:, j, :]
            for m in range(i + 1, num_rows):
                step_similarity = calculate_cosine_similarity(
                    step_embeddings[i], step_embeddings[m]
                )
                stepwise_similarity_sums[j] += step_similarity
                stepwise_similarity_counts[j] += 1

    # Calculate average stepwise similarities
    for step in range(num_steps):
        stepwise_similarity[step] = (
            stepwise_similarity_sums[step] / stepwise_similarity_counts[step]
            if stepwise_similarity_counts[step] > 0
            else 0
        )

    # Calculate mean similarity matrix across all trials
    mean_similarity_matrix = np.mean(similarity_tensor, axis=2)

    # Convert results to DataFrames
    mean_similarity_df = pd.DataFrame(
        mean_similarity_matrix,
        columns=range(1, num_steps + 1),
        index=range(1, num_steps + 1),
    )
    stepwise_similarity_df = pd.DataFrame(stepwise_similarity)

    # Return results as JSON-serialized DataFrames
    result = {
        "mean_similarity_df": mean_similarity_df.to_json(),
        "stepwise_similarity_df": stepwise_similarity_df.to_json(),
    }

    return result